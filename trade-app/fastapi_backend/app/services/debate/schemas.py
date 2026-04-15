from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


SUPPORTED_ASSETS = {"bitcoin", "btc", "ethereum", "eth", "solana", "sol"}


class DebateMessage(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    role: str = Field(..., description="bull | bear")
    content: str


class DebateStartRequest(BaseModel):
    asset: str = Field(..., min_length=1, max_length=20)

    @field_validator("asset")
    @classmethod
    def validate_asset(cls, v: str) -> str:
        normalized = v.lower().strip()
        if normalized not in SUPPORTED_ASSETS:
            raise ValueError(
                f"Unsupported asset: {v}. Supported: {', '.join(sorted(SUPPORTED_ASSETS))}"
            )
        return normalized


class DebateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    debate_id: str = Field(serialization_alias="debateId")
    asset: str
    status: str
    messages: list[DebateMessage]
    current_turn: int = Field(serialization_alias="currentTurn")
    max_turns: int = Field(serialization_alias="maxTurns")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        serialization_alias="createdAt",
    )


class DebateMeta(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    latency_ms: int = Field(serialization_alias="latencyMs")


class DebateErrorResponse(BaseModel):
    code: str
    message: str


class StandardDebateResponse(BaseModel):
    """Standard Response Envelope matching market.py pattern."""

    model_config = ConfigDict(populate_by_name=True)

    data: DebateResponse | None = None
    error: DebateErrorResponse | None = None
    meta: DebateMeta | dict[str, Any] = {}


class DebateHistoryItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    external_id: str = Field(serialization_alias="externalId")
    asset: str
    status: str
    guardian_verdict: str | None = Field(None, serialization_alias="guardianVerdict")
    guardian_interrupts_count: int = Field(
        0, serialization_alias="guardianInterruptsCount"
    )
    total_votes: int = Field(0, serialization_alias="totalVotes")
    vote_breakdown: dict[str, int] = Field(
        default_factory=dict, serialization_alias="voteBreakdown"
    )
    winner: str
    created_at: datetime = Field(serialization_alias="createdAt")
    completed_at: datetime | None = Field(None, serialization_alias="completedAt")


class DebateHistoryMeta(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    page: int
    size: int
    total: int
    pages: int


class StandardDebateHistoryResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: list[DebateHistoryItem]
    error: DebateErrorResponse | None = None
    meta: DebateHistoryMeta


class ActiveDebateSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(serialization_alias="id")
    asset: str
    status: str
    started_at: datetime = Field(serialization_alias="startedAt")
    viewer_count: int | None = Field(None, serialization_alias="viewerCount")


class StandardActiveDebateResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: ActiveDebateSummary | None = None
    error: DebateErrorResponse | None = None
    meta: DebateMeta | dict[str, Any] = {}
