import time
import logging

from fastapi import APIRouter, Response, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.services.debate.repository import DebateRepository
from app.services.debate.schemas import (
    ActiveDebateSummary,
    DebateHistoryItem,
    DebateMeta,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["landing"])


class LandingData(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    active_debate: ActiveDebateSummary | None = Field(
        None, serialization_alias="activeDebate"
    )
    recent_debates: list[DebateHistoryItem] = Field(
        default_factory=list, serialization_alias="recentDebates"
    )


class StandardLandingResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    data: LandingData
    error: dict | None = None
    meta: DebateMeta | dict = {}


@router.get("/landing", response_model=StandardLandingResponse)
async def get_landing_data(
    response: Response,
    session: AsyncSession = Depends(get_async_session),
) -> StandardLandingResponse:
    start_time = time.time()

    from app.services.debate.cache import (
        get_cached_active_debate,
        set_cached_active_debate,
    )

    active_debate = None
    cached = await get_cached_active_debate()
    if cached is not None:
        try:
            from app.services.debate.schemas import ActiveDebateSummary as _ADS

            active_debate = (
                _ADS.model_validate(cached) if cached != "__null_sentinel__" else None
            )
        except Exception:
            active_debate = None
    else:
        repo = DebateRepository(session)
        result = await repo.get_active_debate()
        data_dict = result.model_dump(by_alias=True) if result else None
        await set_cached_active_debate(data_dict)
        active_debate = result

    repo = DebateRepository(session)
    recent_debates, _ = await repo.get_filtered_debates(page=1, size=3)

    latency_ms = int((time.time() - start_time) * 1000)
    response.headers["Cache-Control"] = "public, s-maxage=15, stale-while-revalidate=30"

    return StandardLandingResponse(
        data=LandingData(
            active_debate=active_debate,
            recent_debates=recent_debates,
        ),
        error=None,
        meta=DebateMeta(latency_ms=latency_ms),
    )
