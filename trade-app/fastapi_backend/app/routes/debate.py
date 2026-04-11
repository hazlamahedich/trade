import hashlib
import logging
import time

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.services.debate import DebateService
from app.services.debate.schemas import (
    DebateStartRequest,
    StandardDebateResponse,
    DebateMeta,
)
from app.services.debate.vote_schemas import (
    VoteRequest,
    StandardVoteResponse,
    StandardDebateResultResponse,
    DebateResultMeta,
    VoteSuccessMeta,
)
from app.services.debate.repository import DebateRepository
from app.services.debate.exceptions import StaleDataError, LLMProviderError
from app.services.rate_limiter import (
    RateLimiter,
    create_vote_rate_limiter,
    create_vote_capacity_limiter,
)

router = APIRouter(prefix="/api/debate", tags=["debate"])

logger = logging.getLogger(__name__)

_debate_service: DebateService | None = None
_vote_limiter: RateLimiter | None = None
_capacity_limiter: RateLimiter | None = None


def get_debate_service() -> DebateService:
    global _debate_service
    if _debate_service is None:
        _debate_service = DebateService()
    return _debate_service


def _get_vote_limiter() -> RateLimiter:
    global _vote_limiter
    if _vote_limiter is None:
        _vote_limiter = create_vote_rate_limiter()
    return _vote_limiter


def _get_capacity_limiter() -> RateLimiter:
    global _capacity_limiter
    if _capacity_limiter is None:
        _capacity_limiter = create_vote_capacity_limiter()
    return _capacity_limiter


def _hash_fingerprint(fp: str) -> str:
    return hashlib.sha256(fp.encode()).hexdigest()[:16]


@router.post("/start", response_model=StandardDebateResponse)
async def start_debate(request: DebateStartRequest) -> StandardDebateResponse:
    try:
        result = await get_debate_service().start_debate(request.asset)
        return StandardDebateResponse(
            data=result, error=None, meta=DebateMeta(latency_ms=0)
        )
    except StaleDataError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "data": None,
                "error": {
                    "code": "STALE_MARKET_DATA",
                    "message": str(e)
                    or "Market data is older than 60 seconds. Cannot start debate.",
                },
                "meta": {},
            },
        )
    except LLMProviderError as e:
        logger.error(f"LLM provider error for {request.asset}: {e}")
        raise HTTPException(
            status_code=503,
            detail={
                "data": None,
                "error": {
                    "code": "LLM_PROVIDER_ERROR",
                    "message": str(e) or "LLM service temporarily unavailable",
                },
                "meta": {},
            },
        )
    except Exception as e:
        logger.error(f"Unexpected error starting debate for {request.asset}: {e}")
        raise HTTPException(
            status_code=503,
            detail={
                "data": None,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Service temporarily unavailable",
                },
                "meta": {},
            },
        )


@router.get("/{debate_id}/result", response_model=StandardDebateResultResponse)
async def get_debate_result(
    debate_id: str,
    session: AsyncSession = Depends(get_async_session),
) -> StandardDebateResultResponse:
    start_time = time.time()
    repo = DebateRepository(session)
    result = await repo.get_result(debate_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail={
                "data": None,
                "error": {
                    "code": "DEBATE_NOT_FOUND",
                    "message": f"Debate {debate_id} not found",
                },
                "meta": {},
            },
        )

    latency_ms = int((time.time() - start_time) * 1000)
    return StandardDebateResultResponse(
        data=result,
        error=None,
        meta=DebateResultMeta(latency_ms=latency_ms),
    )


@router.post("/vote", response_model=StandardVoteResponse)
async def cast_vote(
    request: VoteRequest,
    session: AsyncSession = Depends(get_async_session),
) -> StandardVoteResponse:
    start_time = time.time()
    repo = DebateRepository(session)

    # Guard 1: Debate exists
    debate = await repo.get_by_external_id(request.debate_id)
    if debate is None:
        raise HTTPException(
            status_code=404,
            detail={
                "data": None,
                "error": {
                    "code": "DEBATE_NOT_FOUND",
                    "message": f"Debate {request.debate_id} not found",
                },
                "meta": {},
            },
        )

    # Guard 2: Debate must be running
    if debate.status != "running":
        raise HTTPException(
            status_code=422,
            detail={
                "data": None,
                "error": {
                    "code": "DEBATE_NOT_ACTIVE",
                    "message": f"Debate is not active (status: {debate.status})",
                },
                "meta": {"debateStatus": debate.status},
            },
        )

    # Guard 3: Duplicate prevention (Postgres)
    is_duplicate = await repo.has_existing_vote(
        debate_id=debate.id,
        voter_fingerprint=request.voter_fingerprint,
    )
    if is_duplicate:
        raise HTTPException(
            status_code=409,
            detail={
                "data": None,
                "error": {
                    "code": "DUPLICATE_VOTE",
                    "message": "This voter has already voted on this debate",
                },
                "meta": {},
            },
        )

    # Guard 4: Rate limiter (Redis per-voter) — runs before capacity
    # so rate-limited requests never consume global capacity budget
    rate_result = await _get_vote_limiter().check(request.voter_fingerprint)
    if not rate_result.allowed:
        retry_ms = max(0, int((rate_result.reset_at - time.time()) * 1000))
        logger.warning(
            "Voting rejected: rate limited",
            extra={
                "debate_id": request.debate_id,
                "voter_fingerprint": _hash_fingerprint(request.voter_fingerprint),
                "rejection_type": "RATE_LIMITED",
                "retry_after_ms": retry_ms,
            },
        )
        raise HTTPException(
            status_code=429,
            detail={
                "data": None,
                "error": {
                    "code": "RATE_LIMITED",
                    "message": "Rate limit exceeded. Please slow down.",
                },
                "meta": {"retryAfterMs": retry_ms},
            },
        )

    # Guard 5: Capacity limiter (Redis global)
    capacity_result = await _get_capacity_limiter().check("global")
    if not capacity_result.allowed:
        retry_ms = max(0, int((capacity_result.reset_at - time.time()) * 1000))
        logger.warning(
            "Voting rejected: capacity exceeded",
            extra={
                "debate_id": request.debate_id,
                "voter_fingerprint": _hash_fingerprint(request.voter_fingerprint),
                "rejection_type": "VOTING_DISABLED",
                "retry_after_ms": retry_ms,
            },
        )
        raise HTTPException(
            status_code=503,
            detail={
                "data": None,
                "error": {
                    "code": "VOTING_DISABLED",
                    "message": "Voting is temporarily disabled due to high traffic. Please try again later.",
                },
                "meta": {"estimatedWaitMs": retry_ms},
            },
        )

    # Guard 6: Cast vote (Postgres write)
    try:
        result = await repo.create_vote(
            debate_id=debate.id,
            debate_external_id=debate.external_id,
            choice=request.choice,
            voter_fingerprint=request.voter_fingerprint,
        )
    except IntegrityError:
        raise HTTPException(
            status_code=409,
            detail={
                "data": None,
                "error": {
                    "code": "DUPLICATE_VOTE",
                    "message": "This voter has already voted on this debate",
                },
                "meta": {},
            },
        )
    except Exception as e:
        logger.error(f"Vote write failed for debate {request.debate_id}: {e}")
        raise HTTPException(
            status_code=503,
            detail={
                "data": None,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Failed to record vote. Please try again.",
                },
                "meta": {},
            },
        )

    latency_ms = int((time.time() - start_time) * 1000)
    return StandardVoteResponse(
        data=result,
        error=None,
        meta=VoteSuccessMeta(latency_ms=latency_ms, is_final=True),
    )
