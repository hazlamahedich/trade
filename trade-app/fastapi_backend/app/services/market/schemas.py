from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


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


class OHLCVCandle(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    time: int
    open: float
    high: float
    low: float
    close: float
    volume: int | None = None


class TechnicalIndicators(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    rsi_14: float | None = Field(default=None, serialization_alias="rsi14")
    macd: dict[str, float] | None = None
    sma_20: float | None = Field(default=None, serialization_alias="sma20")
    sma_50: float | None = Field(default=None, serialization_alias="sma50")
    bollinger_bands: dict[str, float] | None = None
    atr_14: float | None = Field(default=None, serialization_alias="atr14")
    change_24h: float | None = Field(default=None, serialization_alias="change24h")
    change_7d: float | None = Field(default=None, serialization_alias="change7d")
    volume_ratio: float | None = Field(default=None, serialization_alias="volumeRatio")
    support_levels: list[float] | None = Field(
        default=None, serialization_alias="supportLevels"
    )
    resistance_levels: list[float] | None = Field(
        default=None, serialization_alias="resistanceLevels"
    )


class ForexMeta(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    pair: str
    base_currency: str = Field(serialization_alias="baseCurrency")
    quote_currency: str = Field(serialization_alias="quoteCurrency")
    spread: float | None = None
    pip_value: float | None = Field(default=None, serialization_alias="pipValue")
    lot_size: int | None = Field(default=None, serialization_alias="lotSize")


class MarketContext(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    asset: str
    price: float
    news_summary: list[str]
    is_stale: bool = Field(serialization_alias="isStale")
    ohlcv: list[OHLCVCandle] | None = None
    technicals: TechnicalIndicators | None = None
    forex_meta: ForexMeta | None = Field(default=None, serialization_alias="forexMeta")


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


class FreshnessStatus(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    asset: str
    is_stale: bool
    last_update: datetime | None = None
    age_seconds: int
    threshold_seconds: int = 60
