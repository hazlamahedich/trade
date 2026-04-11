import time
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4
from datetime import datetime, timezone
from contextlib import contextmanager

from httpx import AsyncClient, ASGITransport

from app.main import app
from app.services.debate.vote_schemas import VoteResponse
from app.services.rate_limiter import RateLimitResult


def make_debate(
    external_id: str = "deb_test123", asset: str = "bitcoin", **kwargs
) -> MagicMock:
    d = MagicMock()
    d.id = uuid4()
    d.external_id = external_id
    d.asset = asset
    d.status = kwargs.get("status", "running")
    d.current_turn = kwargs.get("current_turn", 6)
    d.max_turns = kwargs.get("max_turns", 6)
    d.guardian_verdict = kwargs.get("guardian_verdict", "Caution")
    d.guardian_interrupts_count = kwargs.get("guardian_interrupts_count", 2)
    d.transcript = kwargs.get("transcript", None)
    d.created_at = kwargs.get("created_at", datetime.now(timezone.utc))
    d.completed_at = kwargs.get("completed_at", datetime.now(timezone.utc))
    return d


def allowed_result(limit: int = 30) -> RateLimitResult:
    return RateLimitResult(
        allowed=True,
        current=1,
        limit=limit,
        remaining=limit - 1,
        reset_at=time.time() + 60,
    )


def blocked_result(limit: int = 30) -> RateLimitResult:
    return RateLimitResult(
        allowed=False,
        current=limit + 1,
        limit=limit,
        remaining=0,
        reset_at=time.time() + 30,
    )


def make_vote_response(
    debate_id: str = "deb_test123",
    choice: str = "bull",
    fingerprint: str = "fp_123",
) -> VoteResponse:
    return VoteResponse(
        vote_id=str(uuid4()),
        debate_id=debate_id,
        choice=choice,
        voter_fingerprint=fingerprint,
    )


def mock_repo_with_running_debate(
    has_existing: bool = False, vote_resp: VoteResponse | None = None
) -> AsyncMock:
    mock_repo = AsyncMock()
    mock_repo.get_by_external_id = AsyncMock(return_value=make_debate(status="running"))
    mock_repo.has_existing_vote = AsyncMock(return_value=has_existing)
    mock_repo.create_vote = AsyncMock(return_value=vote_resp or make_vote_response())
    return mock_repo


VOTE_URL = "/api/debate/vote"
DEFAULT_PAYLOAD = {
    "debate_id": "deb_test123",
    "choice": "bull",
    "voter_fingerprint": "fp_123",
}


@contextmanager
def mock_vote_deps(
    has_existing: bool = False,
    vote_resp: VoteResponse | None = None,
    rate_result: RateLimitResult | None = None,
    capacity_result: RateLimitResult | None = None,
    repo_override: AsyncMock | None = None,
):
    from unittest.mock import patch

    _rate_result = rate_result or allowed_result()
    _capacity_result = capacity_result or allowed_result(10000)

    with (
        patch("app.routes.debate.DebateRepository") as MockRepo,
        patch("app.routes.debate._get_vote_limiter") as mock_rl,
        patch("app.routes.debate._get_capacity_limiter") as mock_cl,
    ):
        MockRepo.return_value = repo_override or mock_repo_with_running_debate(
            has_existing=has_existing, vote_resp=vote_resp
        )
        mock_rl.return_value.check = AsyncMock(return_value=_rate_result)
        mock_cl.return_value.check = AsyncMock(return_value=_capacity_result)
        yield {
            "repo": MockRepo,
            "rate_limiter": mock_rl,
            "capacity_limiter": mock_cl,
        }


async def post_vote(
    client: AsyncClient,
    payload: dict | None = None,
):
    resp = await client.post(VOTE_URL, json=payload or DEFAULT_PAYLOAD)
    return resp


async def make_client() -> AsyncClient:
    return AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost:8000"
    )
