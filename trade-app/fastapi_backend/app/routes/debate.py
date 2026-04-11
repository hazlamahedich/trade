import logging
import time

from fastapi import APIRouter, HTTPException, Depends
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
)
from app.services.debate.repository import DebateRepository
from app.services.debate.exceptions import StaleDataError, LLMProviderError

router = APIRouter(prefix="/api/debate", tags=["debate"])

logger = logging.getLogger(__name__)

_debate_service: DebateService | None = None


def get_debate_service() -> DebateService:
    global _debate_service
    if _debate_service is None:
        _debate_service = DebateService()
    return _debate_service


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
    repo = DebateRepository(session)

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

    result = await repo.cast_vote(
        debate_external_id=request.debate_id,
        choice=request.choice,
        voter_fingerprint=request.voter_fingerprint,
    )
    if result is None:
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

    return StandardVoteResponse(data=result, error=None, meta={})
