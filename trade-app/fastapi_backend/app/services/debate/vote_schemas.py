from datetime import datetime, timezone
from typing import Any
from pydantic import BaseModel, ConfigDict, Field, field_validator

VALID_VOTE_CHOICES = {"bull", "bear", "undecided"}


class VoteRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    debate_id: str = Field(serialization_alias="debateId", min_length=1)
    choice: str = Field(..., min_length=1)
    voter_fingerprint: str = Field(
        serialization_alias="voterFingerprint", min_length=1, max_length=128
    )

    @field_validator("choice")
    @classmethod
    def validate_choice(cls, v: str) -> str:
        normalized = v.lower().strip()
        if normalized not in VALID_VOTE_CHOICES:
            raise ValueError(
                f"Invalid vote choice: {v}. "
                f"Supported: {', '.join(sorted(VALID_VOTE_CHOICES))}"
            )
        return normalized


class VoteResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    vote_id: str = Field(serialization_alias="voteId")
    debate_id: str = Field(serialization_alias="debateId")
    choice: str
    voter_fingerprint: str = Field(serialization_alias="voterFingerprint")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        serialization_alias="createdAt",
    )


class DebateResultResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    debate_id: str = Field(serialization_alias="debateId")
    asset: str
    status: str
    current_turn: int = Field(serialization_alias="currentTurn")
    max_turns: int = Field(serialization_alias="maxTurns")
    guardian_verdict: str | None = Field(None, serialization_alias="guardianVerdict")
    guardian_interrupts_count: int = Field(
        0, serialization_alias="guardianInterruptsCount"
    )
    created_at: datetime = Field(serialization_alias="createdAt")
    completed_at: datetime | None = Field(None, serialization_alias="completedAt")
    total_votes: int = Field(0, serialization_alias="totalVotes")
    vote_breakdown: dict[str, int] = Field(
        default_factory=dict, serialization_alias="voteBreakdown"
    )


class DebateResultMeta(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    latency_ms: int = Field(serialization_alias="latencyMs")


class StandardVoteResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: VoteResponse | None = None
    error: dict[str, str] | None = None
    meta: dict[str, Any] = {}


class StandardDebateResultResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: DebateResultResponse | None = None
    error: dict[str, str] | None = None
    meta: DebateResultMeta | dict[str, Any] = {}
