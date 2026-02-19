import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket
from langchain_core.callbacks import AsyncCallbackHandler

from app.services.debate.ws_schemas import WebSocketAction
from app.services.redis_client import get_redis_client

logger = logging.getLogger(__name__)

CONNECTION_RATE_LIMIT = 10
HEARTBEAT_INTERVAL = 30
STREAM_STATE_TTL = 3600
RATE_LIMIT_WINDOW = 60


class DebateConnectionManager:
    """Manages WebSocket connections for debate broadcasting with isolation."""

    def __init__(self) -> None:
        self.active_debates: dict[str, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, debate_id: str, websocket: WebSocket) -> None:
        """Register a websocket connection for a debate."""
        async with self._lock:
            if debate_id not in self.active_debates:
                self.active_debates[debate_id] = set()
            self.active_debates[debate_id].add(websocket)
        logger.info(f"WebSocket connected to debate {debate_id}")

    async def disconnect(self, debate_id: str, websocket: WebSocket) -> None:
        """Remove a websocket connection from a debate."""
        async with self._lock:
            if debate_id in self.active_debates:
                self.active_debates[debate_id].discard(websocket)
                if not self.active_debates[debate_id]:
                    del self.active_debates[debate_id]
        logger.info(f"WebSocket disconnected from debate {debate_id}")

    async def broadcast_to_debate(self, debate_id: str, action: dict[str, Any]) -> None:
        """Send action to all clients watching the debate."""
        connections = self.active_debates.get(debate_id, set()).copy()
        disconnected = []
        for ws in connections:
            try:
                await ws.send_json(action)
            except Exception as e:
                logger.warning(f"Failed to send to websocket: {e}")
                disconnected.append(ws)

        for ws in disconnected:
            await self.disconnect(debate_id, ws)

    def get_connection_count(self, debate_id: str) -> int:
        """Get the number of active connections for a debate."""
        return len(self.active_debates.get(debate_id, set()))

    async def close_all_for_debate(
        self, debate_id: str, code: int = 1000, reason: str = ""
    ) -> None:
        """Close all connections for a debate."""
        connections = self.active_debates.get(debate_id, set()).copy()
        for ws in connections:
            try:
                await ws.close(code=code, reason=reason)
            except Exception:
                pass
        async with self._lock:
            if debate_id in self.active_debates:
                del self.active_debates[debate_id]


connection_manager = DebateConnectionManager()


async def check_connection_rate_limit(ip: str) -> bool:
    """Check if IP has exceeded connection rate limit using Redis."""
    if ip == "unknown":
        return False

    try:
        redis = await get_redis_client()
        key = f"ws_rate_limit:{ip}"
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, RATE_LIMIT_WINDOW)
        return count <= CONNECTION_RATE_LIMIT
    except Exception as e:
        logger.warning(f"Redis rate limit check failed, allowing connection: {e}")
        return True


class TokenStreamingHandler(AsyncCallbackHandler):
    """Streams LLM tokens directly to WebSocket via connection manager."""

    def __init__(
        self,
        manager: DebateConnectionManager,
        debate_id: str,
        agent: str,
    ):
        self.manager = manager
        self.debate_id = debate_id
        self.agent = agent

    async def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        try:
            action = WebSocketAction(
                type="DEBATE/TOKEN_RECEIVED",
                payload={
                    "debateId": self.debate_id,
                    "agent": self.agent,
                    "token": token,
                },
            )
            await self.manager.broadcast_to_debate(
                self.debate_id, action.model_dump(by_alias=True)
            )
        except Exception as e:
            logger.warning(f"Failed to broadcast token: {e}")


class DebateStreamState:
    """Manages debate stream state in Redis for reconnection support."""

    def __init__(self) -> None:
        self._redis: Any = None

    async def _get_redis(self) -> Any:
        if self._redis is None:
            self._redis = await get_redis_client()
        return self._redis

    async def save_state(self, debate_id: str, state: dict[str, Any]) -> None:
        redis = await self._get_redis()
        key = f"debate_stream:{debate_id}"
        await redis.setex(key, STREAM_STATE_TTL, json.dumps(state))

    async def get_state(self, debate_id: str) -> dict[str, Any] | None:
        redis = await self._get_redis()
        key = f"debate_stream:{debate_id}"
        data = await redis.get(key)
        return json.loads(data) if data else None

    async def delete_state(self, debate_id: str) -> None:
        redis = await self._get_redis()
        key = f"debate_stream:{debate_id}"
        await redis.delete(key)


stream_state = DebateStreamState()


async def send_connected_action(
    manager: DebateConnectionManager, debate_id: str, status: str
) -> None:
    """Send DEBATE/CONNECTED action to all viewers."""
    action = WebSocketAction(
        type="DEBATE/CONNECTED",
        payload={"debateId": debate_id, "status": status},
    )
    await manager.broadcast_to_debate(debate_id, action.model_dump(by_alias=True))


async def send_status_update(
    manager: DebateConnectionManager, debate_id: str, status: str
) -> None:
    """Send DEBATE/STATUS_UPDATE action to all viewers."""
    action = WebSocketAction(
        type="DEBATE/STATUS_UPDATE",
        payload={"debateId": debate_id, "status": status},
    )
    await manager.broadcast_to_debate(debate_id, action.model_dump(by_alias=True))


async def send_turn_change(
    manager: DebateConnectionManager, debate_id: str, current_agent: str
) -> None:
    """Send DEBATE/TURN_CHANGE action to all viewers."""
    action = WebSocketAction(
        type="DEBATE/TURN_CHANGE",
        payload={"debateId": debate_id, "currentAgent": current_agent},
    )
    await manager.broadcast_to_debate(debate_id, action.model_dump(by_alias=True))


async def send_error(
    manager: DebateConnectionManager, debate_id: str, code: str, message: str
) -> None:
    """Send DEBATE/ERROR action to all viewers."""
    action = WebSocketAction(
        type="DEBATE/ERROR",
        payload={"code": code, "message": message},
    )
    await manager.broadcast_to_debate(debate_id, action.model_dump(by_alias=True))


async def send_argument_complete(
    manager: DebateConnectionManager,
    debate_id: str,
    agent: str,
    content: str,
    turn: int | None = None,
) -> None:
    """Send DEBATE/ARGUMENT_COMPLETE action to all viewers."""
    action = WebSocketAction(
        type="DEBATE/ARGUMENT_COMPLETE",
        payload={
            "debateId": debate_id,
            "agent": agent,
            "content": content,
            "turn": turn,
        },
    )
    await manager.broadcast_to_debate(debate_id, action.model_dump(by_alias=True))


async def heartbeat(
    websocket: WebSocket,
    manager: DebateConnectionManager,
    debate_id: str,
    stop_event: asyncio.Event,
) -> None:
    """Send periodic pings to keep connection alive."""
    while not stop_event.is_set():
        try:
            await asyncio.sleep(HEARTBEAT_INTERVAL)
            if not stop_event.is_set():
                action = WebSocketAction(
                    type="DEBATE/PING",
                    payload={},
                )
                await websocket.send_json(action.model_dump(by_alias=True))
        except asyncio.CancelledError:
            break
        except Exception:
            break
