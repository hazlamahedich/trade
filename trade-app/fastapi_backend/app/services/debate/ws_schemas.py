from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


WebSocketActionType = Literal[
    "DEBATE/CONNECTED",
    "DEBATE/TOKEN_RECEIVED",
    "DEBATE/ARGUMENT_COMPLETE",
    "DEBATE/TURN_CHANGE",
    "DEBATE/STATUS_UPDATE",
    "DEBATE/ERROR",
    "DEBATE/PING",
]


class WebSocketAction(BaseModel):
    """Redux-style action for WebSocket messages."""

    model_config = ConfigDict(populate_by_name=True)

    type: WebSocketActionType
    payload: dict[str, Any] = Field(default_factory=dict)
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class TokenReceivedPayload(BaseModel):
    """Payload for DEBATE/TOKEN_RECEIVED action."""

    model_config = ConfigDict(populate_by_name=True)

    debate_id: str = Field(serialization_alias="debateId")
    agent: str
    token: str
    turn: int | None = None


class ArgumentCompletePayload(BaseModel):
    """Payload for DEBATE/ARGUMENT_COMPLETE action."""

    model_config = ConfigDict(populate_by_name=True)

    debate_id: str = Field(serialization_alias="debateId")
    agent: str
    content: str
    turn: int | None = None


class StatusUpdatePayload(BaseModel):
    """Payload for DEBATE/STATUS_UPDATE action."""

    model_config = ConfigDict(populate_by_name=True)

    debate_id: str = Field(serialization_alias="debateId")
    status: str


class ConnectedPayload(BaseModel):
    """Payload for DEBATE/CONNECTED action."""

    model_config = ConfigDict(populate_by_name=True)

    debate_id: str = Field(serialization_alias="debateId")
    status: str


class TurnChangePayload(BaseModel):
    """Payload for DEBATE/TURN_CHANGE action."""

    model_config = ConfigDict(populate_by_name=True)

    debate_id: str = Field(serialization_alias="debateId")
    current_agent: str = Field(serialization_alias="currentAgent")


class ErrorPayload(BaseModel):
    """Payload for DEBATE/ERROR action."""

    model_config = ConfigDict(populate_by_name=True)

    code: str
    message: str


class WebSocketCloseCodes:
    """RFC 6455 compliant WebSocket close codes for application use."""

    UNAUTHORIZED = 4001
    ORIGIN_NOT_ALLOWED = 4003
    DEBATE_NOT_FOUND = 4004
    DEBATE_ALREADY_RUNNING = 4009
    RATE_LIMITED = 4029
    INTERNAL_ERROR = 4500


CLOSE_CODE_REASONS = {
    WebSocketCloseCodes.UNAUTHORIZED: "Unauthorized",
    WebSocketCloseCodes.ORIGIN_NOT_ALLOWED: "Origin not allowed",
    WebSocketCloseCodes.DEBATE_NOT_FOUND: "Debate not found",
    WebSocketCloseCodes.DEBATE_ALREADY_RUNNING: "Debate already running",
    WebSocketCloseCodes.RATE_LIMITED: "Rate limited",
    WebSocketCloseCodes.INTERNAL_ERROR: "Internal error",
}
