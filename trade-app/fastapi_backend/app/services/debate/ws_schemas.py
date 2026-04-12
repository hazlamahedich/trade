from datetime import datetime, timezone

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.services.debate.state import RiskLevel  # noqa: F401 — re-exported for backward compatibility

WebSocketActionType = Literal[
    "DEBATE/CONNECTED",
    "DEBATE/TOKEN_RECEIVED",
    "DEBATE/ARGUMENT_COMPLETE",
    "DEBATE/TURN_CHANGE",
    "DEBATE/STATUS_UPDATE",
    "DEBATE/ERROR",
    "DEBATE/PING",
    "DEBATE/DATA_STALE",
    "DEBATE/DATA_REFRESHED",
    "DEBATE/REASONING_NODE",
    "DEBATE/GUARDIAN_INTERRUPT",
    "DEBATE/GUARDIAN_VERDICT",
    "DEBATE/DEBATE_PAUSED",
    "DEBATE/DEBATE_RESUMED",
    "DEBATE/GUARDIAN_INTERRUPT_ACK",
    "DEBATE/VOTE_UPDATE",
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
    is_redacted: bool = Field(default=False, serialization_alias="isRedacted")
    redacted_phrases: list[str] = Field(
        default_factory=list, serialization_alias="redactedPhrases"
    )


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


class DataStalePayload(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    debate_id: str = Field(serialization_alias="debateId")
    last_update: datetime | None = Field(default=None, serialization_alias="lastUpdate")
    age_seconds: int = Field(serialization_alias="ageSeconds")
    message: str


class DataRefreshedPayload(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    debate_id: str = Field(serialization_alias="debateId")
    message: str


class ReasoningNodePayload(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    debate_id: str = Field(serialization_alias="debateId")
    node_id: str = Field(serialization_alias="nodeId")
    node_type: str = Field(serialization_alias="nodeType")
    label: str
    summary: str
    agent: str | None = None
    parent_id: str | None = Field(default=None, serialization_alias="parentId")
    is_winning: bool = Field(default=False, serialization_alias="isWinning")
    turn: int | None = None


class GuardianInterruptPayload(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    debate_id: str = Field(serialization_alias="debateId")
    risk_level: RiskLevel
    reason: str
    fallacy_type: str | None = None
    original_agent: str
    summary_verdict: str
    turn: int | None = None


class GuardianVerdictPayload(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    debate_id: str = Field(serialization_alias="debateId")
    verdict: str
    risk_level: RiskLevel
    summary: str
    reasoning: str
    total_interrupts: int = 0


class DebatePausedPayload(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    debate_id: str = Field(serialization_alias="debateId")
    reason: str
    risk_level: RiskLevel
    summary_verdict: str
    turn: int | None = None


class DebateResumedPayload(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    debate_id: str = Field(serialization_alias="debateId")
    turn: int | None = None


class VoteUpdatePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    debate_id: str = Field(serialization_alias="debateId")
    total_votes: int = Field(serialization_alias="totalVotes")
    vote_breakdown: dict[str, int] = Field(serialization_alias="voteBreakdown")
