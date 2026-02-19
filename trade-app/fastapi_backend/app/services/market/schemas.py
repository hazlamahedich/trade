from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class NewsItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str
    url: str | None = None
    source: str = "unknown"
    timestamp: datetime


class MarketData(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    asset: str
    price: float
    currency: str = "usd"
    news: list[NewsItem] = []
    is_stale: bool = Field(default=False, serialization_alias="isStale")
    fetched_at: datetime = Field(
        default_factory=datetime.utcnow, serialization_alias="fetchedAt"
    )


class MarketContext(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    asset: str
    price: float
    news_summary: list[str]
    is_stale: bool = Field(serialization_alias="isStale")


class MarketMeta(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    latency_ms: int = Field(serialization_alias="latencyMs")
    provider: str | None = None
    stale_warning: bool | None = Field(default=None, serialization_alias="staleWarning")


class MarketErrorResponse(BaseModel):
    code: str
    message: str


class StandardMarketResponse(BaseModel):
    data: MarketData | None = None
    error: MarketErrorResponse | None = None
    meta: MarketMeta | dict[str, Any] = {}
