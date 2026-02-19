import asyncio
import logging
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.config import settings
from app.services.debate.streaming import (
    connection_manager,
    check_connection_rate_limit,
    heartbeat,
    send_connected_action,
    send_error,
    stream_state,
)
from app.services.debate.ws_schemas import (
    WebSocketAction,
    WebSocketCloseCodes,
    CLOSE_CODE_REASONS,
)
from app.users import get_jwt_strategy

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


async def validate_token(token: str) -> dict[str, Any] | None:
    """Validate JWT token and return user info."""
    if settings.FIXED_QA_TOKEN and token == settings.FIXED_QA_TOKEN:
        return {"id": "qa-user", "email": "qa@test.com"}

    try:
        strategy = get_jwt_strategy()
        user = await strategy.read_token(token)
        if user:
            return {"id": str(user.id), "email": user.email}
    except Exception as e:
        logger.warning(f"Token validation failed: {e}")
    return None


async def validate_origin(websocket: WebSocket) -> bool:
    """Validate WebSocket origin for CORS."""
    origin = websocket.headers.get("origin", "")
    allowed = list(settings.CORS_ORIGINS)
    if origin in allowed:
        return True
    if not origin and settings.ENVIRONMENT == "development":
        return True
    return False


@router.websocket("/ws/debate/{debate_id}")
async def websocket_debate(
    websocket: WebSocket,
    debate_id: str,
    token: str = Query(...),
):
    """WebSocket endpoint for streaming debate tokens."""
    client_ip = websocket.client.host if websocket.client else None

    if not client_ip:
        await websocket.accept()
        close_code = WebSocketCloseCodes.RATE_LIMITED
        await websocket.close(code=close_code, reason="Cannot identify client")
        return

    if not await check_connection_rate_limit(client_ip):
        await websocket.accept()
        close_code = WebSocketCloseCodes.RATE_LIMITED
        await websocket.close(code=close_code, reason=CLOSE_CODE_REASONS[close_code])
        return

    if not await validate_origin(websocket):
        await websocket.accept()
        close_code = WebSocketCloseCodes.ORIGIN_NOT_ALLOWED
        await websocket.close(code=close_code, reason=CLOSE_CODE_REASONS[close_code])
        return

    user = await validate_token(token)
    if not user:
        await websocket.accept()
        close_code = WebSocketCloseCodes.UNAUTHORIZED
        await websocket.close(code=close_code, reason=CLOSE_CODE_REASONS[close_code])
        return

    try:
        await websocket.accept()
    except Exception as e:
        logger.error(f"Failed to accept WebSocket connection: {e}")
        return

    await connection_manager.connect(debate_id, websocket)
    logger.info(f"WebSocket connected: debate={debate_id}, user={user['id']}")

    stop_heartbeat = asyncio.Event()
    heartbeat_task = asyncio.create_task(
        heartbeat(websocket, connection_manager, debate_id, stop_heartbeat)
    )

    try:
        existing_state = await stream_state.get_state(debate_id)
        if existing_state:
            status = existing_state.get("status", "running")
        else:
            status = "ready"

        await send_connected_action(connection_manager, debate_id, status)

        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=60.0)
                action_type = data.get("type", "")

                if action_type == "DEBATE/PONG":
                    continue

                if action_type == "DEBATE/GET_STATE":
                    state = await stream_state.get_state(debate_id)
                    if state:
                        action = WebSocketAction(
                            type="DEBATE/STATUS_UPDATE",
                            payload={"debateId": debate_id, **state},
                        )
                        await websocket.send_json(action.model_dump(by_alias=True))

            except asyncio.TimeoutError:
                continue
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.warning(f"WebSocket message error: {e}")
                break

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: debate={debate_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await send_error(connection_manager, debate_id, "INTERNAL_ERROR", str(e))
        except Exception:
            pass
    finally:
        stop_heartbeat.set()
        heartbeat_task.cancel()
        try:
            await heartbeat_task
        except asyncio.CancelledError:
            pass

        await connection_manager.disconnect(debate_id, websocket)
        logger.info(f"WebSocket cleanup complete: debate={debate_id}")
