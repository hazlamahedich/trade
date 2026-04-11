import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket
from langchain_core.callbacks import AsyncCallbackHandler

from app.services.debate.state import RiskLevel
from app.services.debate.ws_schemas import (
    ArgumentCompletePayload,
    DataRefreshedPayload,
    DataStalePayload,
    DebatePausedPayload,
    DebateResumedPayload,
    GuardianInterruptPayload,
    GuardianVerdictPayload,
    ReasoningNodePayload,
    WebSocketAction,
)
from app.services.market.schemas import FreshnessStatus
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
    """Streams LLM tokens to WebSocket via connection manager with sanitization.

    Tokens are accumulated. On flush (threshold or LLM end), the ENTIRE
    accumulated text is sanitized at once so forbidden phrases that span
    token boundaries are always caught. The handler tracks how much
    sanitized text has already been sent and only emits the new portion.
    """

    _TAIL_OVERLAP = 20
    _BUFFER_FLUSH_THRESHOLD = 80

    def __init__(
        self,
        manager: DebateConnectionManager,
        debate_id: str,
        agent: str,
    ):
        self.manager = manager
        self.debate_id = debate_id
        self.agent = agent
        self._accumulated: str = ""
        self._sanitized_sent: int = 0

    def _sanitize_text(self, text: str) -> str:
        from app.services.debate.sanitization import sanitize_response

        return sanitize_response(text)

    async def _try_flush(self) -> None:
        if len(self._accumulated) < self._BUFFER_FLUSH_THRESHOLD:
            return
        full_sanitized = self._sanitize_text(self._accumulated)
        new_part = full_sanitized[self._sanitized_sent :]
        if not new_part:
            return
        self._sanitized_sent = max(0, len(full_sanitized) - self._TAIL_OVERLAP)
        try:
            action = WebSocketAction(
                type="DEBATE/TOKEN_RECEIVED",
                payload={
                    "debateId": self.debate_id,
                    "agent": self.agent,
                    "token": new_part,
                },
            )
            await self.manager.broadcast_to_debate(
                self.debate_id, action.model_dump(by_alias=True)
            )
        except Exception as e:
            logger.warning(f"Failed to broadcast token: {e}")

    async def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        self._accumulated += token
        if len(self._accumulated) >= self._BUFFER_FLUSH_THRESHOLD:
            await self._try_flush()

    async def on_llm_end(self, response: Any, **kwargs: Any) -> None:
        if not self._accumulated:
            return
        full_sanitized = self._sanitize_text(self._accumulated)
        new_part = full_sanitized[self._sanitized_sent :]
        self._accumulated = ""
        self._sanitized_sent = 0
        if not new_part:
            return
        try:
            action = WebSocketAction(
                type="DEBATE/TOKEN_RECEIVED",
                payload={
                    "debateId": self.debate_id,
                    "agent": self.agent,
                    "token": new_part,
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
    is_redacted: bool = False,
    redacted_phrases: list[str] | None = None,
) -> None:
    """Send DEBATE/ARGUMENT_COMPLETE action to all viewers."""
    payload = ArgumentCompletePayload(
        debate_id=debate_id,
        agent=agent,
        content=content,
        turn=turn,
        is_redacted=is_redacted,
        redacted_phrases=redacted_phrases or [],
    )
    action = WebSocketAction(
        type="DEBATE/ARGUMENT_COMPLETE",
        payload=payload.model_dump(by_alias=True),
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


async def send_data_stale(
    manager: DebateConnectionManager,
    debate_id: str,
    freshness: FreshnessStatus,
) -> None:
    """Send DEBATE/DATA_STALE action to all viewers."""
    payload = DataStalePayload(
        debate_id=debate_id,
        last_update=freshness.last_update,
        age_seconds=freshness.age_seconds,
        message=f"Market data is {freshness.age_seconds} seconds old",
    )
    action = WebSocketAction(
        type="DEBATE/DATA_STALE",
        payload=payload.model_dump(by_alias=True),
    )
    await manager.broadcast_to_debate(debate_id, action.model_dump(by_alias=True))


async def send_data_refreshed(
    manager: DebateConnectionManager,
    debate_id: str,
) -> None:
    """Send DEBATE/DATA_REFRESHED action to all viewers."""
    payload = DataRefreshedPayload(
        debate_id=debate_id,
        message="Market data has been refreshed",
    )
    action = WebSocketAction(
        type="DEBATE/DATA_REFRESHED",
        payload=payload.model_dump(by_alias=True),
    )
    await manager.broadcast_to_debate(debate_id, action.model_dump(by_alias=True))


async def send_reasoning_node(
    manager: DebateConnectionManager,
    debate_id: str,
    *,
    node_id: str,
    node_type: str,
    label: str,
    summary: str,
    agent: str | None = None,
    parent_id: str | None = None,
    is_winning: bool = False,
    turn: int | None = None,
) -> None:
    payload = ReasoningNodePayload(
        debate_id=debate_id,
        node_id=node_id,
        node_type=node_type,
        label=label,
        summary=summary,
        agent=agent,
        parent_id=parent_id,
        is_winning=is_winning,
        turn=turn,
    )
    action = WebSocketAction(
        type="DEBATE/REASONING_NODE",
        payload=payload.model_dump(by_alias=True),
    )
    await manager.broadcast_to_debate(debate_id, action.model_dump(by_alias=True))


async def send_guardian_interrupt(
    manager: DebateConnectionManager,
    debate_id: str,
    *,
    risk_level: RiskLevel,
    reason: str,
    fallacy_type: str | None = None,
    original_agent: str,
    summary_verdict: str,
    turn: int | None = None,
) -> None:
    payload = GuardianInterruptPayload(
        debate_id=debate_id,
        risk_level=risk_level,
        reason=reason,
        fallacy_type=fallacy_type,
        original_agent=original_agent,
        summary_verdict=summary_verdict,
        turn=turn,
    )
    action = WebSocketAction(
        type="DEBATE/GUARDIAN_INTERRUPT",
        payload=payload.model_dump(by_alias=True),
    )
    await manager.broadcast_to_debate(debate_id, action.model_dump(by_alias=True))


async def send_guardian_verdict(
    manager: DebateConnectionManager,
    debate_id: str,
    *,
    verdict: str,
    risk_level: RiskLevel,
    summary: str,
    reasoning: str,
    total_interrupts: int = 0,
) -> None:
    payload = GuardianVerdictPayload(
        debate_id=debate_id,
        verdict=verdict,
        risk_level=risk_level,
        summary=summary,
        reasoning=reasoning,
        total_interrupts=total_interrupts,
    )
    action = WebSocketAction(
        type="DEBATE/GUARDIAN_VERDICT",
        payload=payload.model_dump(by_alias=True),
    )
    await manager.broadcast_to_debate(debate_id, action.model_dump(by_alias=True))


async def send_debate_paused(
    manager: DebateConnectionManager,
    debate_id: str,
    *,
    reason: str,
    risk_level: RiskLevel,
    summary_verdict: str,
    turn: int | None = None,
) -> None:
    payload = DebatePausedPayload(
        debate_id=debate_id,
        reason=reason,
        risk_level=risk_level,
        summary_verdict=summary_verdict,
        turn=turn,
    )
    action = WebSocketAction(
        type="DEBATE/DEBATE_PAUSED",
        payload=payload.model_dump(by_alias=True),
    )
    await manager.broadcast_to_debate(debate_id, action.model_dump(by_alias=True))


async def send_debate_resumed(
    manager: DebateConnectionManager,
    debate_id: str,
    *,
    turn: int | None = None,
) -> None:
    payload = DebateResumedPayload(
        debate_id=debate_id,
        turn=turn,
    )
    action = WebSocketAction(
        type="DEBATE/DEBATE_RESUMED",
        payload=payload.model_dump(by_alias=True),
    )
    await manager.broadcast_to_debate(debate_id, action.model_dump(by_alias=True))
