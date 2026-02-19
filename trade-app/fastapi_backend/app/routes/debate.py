import logging

from fastapi import APIRouter, HTTPException

from app.services.debate import DebateService
from app.services.debate.schemas import (
    DebateStartRequest,
    StandardDebateResponse,
    DebateMeta,
)
from app.services.debate.exceptions import StaleDataError, LLMProviderError

router = APIRouter(prefix="/api/debate", tags=["debate"])

logger = logging.getLogger(__name__)

_debate_service: DebateService | None = None


def get_debate_service() -> DebateService:
    """Get or create debate service singleton."""
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
