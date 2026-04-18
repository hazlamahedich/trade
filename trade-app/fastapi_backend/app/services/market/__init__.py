import logging
import time
from datetime import datetime
from typing import Any

from app.config import settings
from app.services.market.cache import MarketDataCache
from app.services.market.provider import YFinanceProvider
from app.services.market.twelvedata_provider import (
    TwelveDataForexProvider,
    is_forex_asset,
)
from app.services.market.schemas import (
    MarketContext,
    MarketData,
    MarketMeta,
    NewsItem,
    OHLCVCandle,
    TechnicalIndicators,
    ForexMeta,
)

logger = logging.getLogger(__name__)


class MarketDataService:
    def __init__(self, redis_url: str | None = None):
        self.redis_url = redis_url or settings.REDIS_URL
        self.cache = MarketDataCache(self.redis_url)
        self.provider = YFinanceProvider()
        self._forex_provider: TwelveDataForexProvider | None = None

    def _get_forex_provider(self) -> TwelveDataForexProvider | None:
        if self._forex_provider is not None:
            return self._forex_provider
        if settings.TWELVEDATA_API_KEY:
            self._forex_provider = TwelveDataForexProvider(
                api_key=settings.TWELVEDATA_API_KEY,
                base_url=settings.TWELVEDATA_BASE_URL,
            )
            return self._forex_provider
        return None

    async def close(self) -> None:
        await self.cache.close()
        await self.provider.close()
        if self._forex_provider:
            await self._forex_provider.close()

    async def get_data(
        self,
        asset: str,
        mock_providers_down: bool = False,
        mock_no_cache: bool = False,
    ) -> tuple[MarketData | None, MarketMeta]:
        start_time = time.time()

        cached_data = (
            None if mock_no_cache else await self.cache.get_cached_market_data(asset)
        )

        if (
            cached_data
            and self.cache.is_cache_valid(cached_data)
            and not mock_providers_down
        ):
            latency_ms = int((time.time() - start_time) * 1000)
            return cached_data, MarketMeta(latency_ms=latency_ms, provider="cache")

        if mock_providers_down:
            if cached_data:
                cached_data.is_stale = True
                latency_ms = int((time.time() - start_time) * 1000)
                return cached_data, MarketMeta(
                    latency_ms=latency_ms, provider="cache", stale_warning=True
                )
            latency_ms = int((time.time() - start_time) * 1000)
            return None, MarketMeta(latency_ms=latency_ms)

        price_data: dict[str, Any] | None = await self.provider.fetch_price(asset)
        news_data: list[NewsItem] = []

        if price_data:
            market_data = MarketData(
                asset=asset,
                price=price_data.get("price", 0.0),
                currency="usd",
                news=news_data,
                is_stale=False,
                fetched_at=datetime.utcnow(),
            )
            await self.cache.set_market_data(asset, market_data)
            latency_ms = int((time.time() - start_time) * 1000)
            return market_data, MarketMeta(
                latency_ms=latency_ms, provider=self.provider.get_name()
            )

        if cached_data:
            cached_data.is_stale = True
            latency_ms = int((time.time() - start_time) * 1000)
            return cached_data, MarketMeta(
                latency_ms=latency_ms, provider="cache", stale_warning=True
            )

        latency_ms = int((time.time() - start_time) * 1000)
        return None, MarketMeta(latency_ms=latency_ms)

    async def get_context(self, asset: str) -> MarketContext | None:
        data, _ = await self.get_data(asset)
        if data is None:
            return None

        ohlcv: list[OHLCVCandle] | None = None
        technicals: TechnicalIndicators | None = None
        forex_meta: ForexMeta | None = None

        if is_forex_asset(asset):
            forex_prov = self._get_forex_provider()
            if forex_prov:
                ohlcv_raw = await forex_prov.fetch_ohlcv(
                    asset, interval="1day", outputsize=30
                )
                if ohlcv_raw:
                    ohlcv = [OHLCVCandle(**c) for c in ohlcv_raw]

                tech_raw = await forex_prov.fetch_technicals(asset)
                if tech_raw:
                    technicals = TechnicalIndicators(
                        rsi_14=tech_raw.get("rsi_14"),
                        macd=tech_raw.get("macd"),
                        sma_20=tech_raw.get("sma_20"),
                        sma_50=tech_raw.get("sma_50"),
                        bollinger_bands=tech_raw.get("bollinger_bands"),
                        atr_14=tech_raw.get("atr_14"),
                        change_24h=tech_raw.get("change_24h"),
                        change_7d=tech_raw.get("change_7d"),
                    )

                meta_raw = await forex_prov.fetch_forex_meta(asset)
                if meta_raw:
                    forex_meta = ForexMeta(**meta_raw)

        if technicals is None:
            tech_data = await self.provider.fetch_technical(asset)
            if tech_data:
                technicals = TechnicalIndicators(
                    rsi_14=tech_data.get("rsi14"),
                    sma_20=tech_data.get("sma20"),
                    sma_50=tech_data.get("sma50"),
                    change_24h=tech_data.get("change24h"),
                    change_7d=tech_data.get("change7d"),
                    volume_ratio=tech_data.get("volumeRatio"),
                    support_levels=tech_data.get("supportLevels"),
                    resistance_levels=tech_data.get("resistanceLevels"),
                )

        extra_parts = self._build_news_summary_parts(technicals, forex_meta)

        return MarketContext(
            asset=data.asset,
            price=data.price,
            news_summary=[n.title for n in data.news[:3]] + extra_parts,
            is_stale=data.is_stale,
            ohlcv=ohlcv,
            technicals=technicals,
            forex_meta=forex_meta,
        )

    @staticmethod
    def _build_news_summary_parts(
        technicals: TechnicalIndicators | None,
        forex_meta: ForexMeta | None,
    ) -> list[str]:
        parts: list[str] = []
        if technicals is None:
            return parts
        if technicals.change_24h is not None:
            parts.append(f"24h change: {technicals.change_24h}%")
        if technicals.change_7d is not None:
            parts.append(f"7d change: {technicals.change_7d}%")
        if technicals.rsi_14 is not None:
            parts.append(f"RSI(14): {technicals.rsi_14}")
        if technicals.sma_20 is not None:
            parts.append(f"SMA20: {technicals.sma_20:,.4f}")
        if technicals.sma_50 is not None:
            parts.append(f"SMA50: {technicals.sma_50:,.4f}")
        if technicals.bollinger_bands is not None:
            bb = technicals.bollinger_bands
            parts.append(
                f"Bollinger Bands: upper={bb['upper']:,.4f} "
                f"mid={bb['middle']:,.4f} lower={bb['lower']:,.4f}"
            )
        if technicals.macd is not None:
            macd = technicals.macd
            parts.append(
                f"MACD: {macd['macd']:,.4f} signal={macd['signal']:,.4f} "
                f"hist={macd['histogram']:,.4f}"
            )
        if technicals.atr_14 is not None:
            parts.append(f"ATR(14): {technicals.atr_14:,.4f}")
        if technicals.support_levels:
            supports = ", ".join(f"{s:,.4f}" for s in technicals.support_levels)
            parts.append(f"Support levels: {supports}")
        if technicals.resistance_levels:
            resistances = ", ".join(f"{r:,.4f}" for r in technicals.resistance_levels)
            parts.append(f"Resistance levels: {resistances}")
        if technicals.volume_ratio is not None:
            parts.append(f"Volume ratio vs 20d avg: {technicals.volume_ratio}x")
        if forex_meta is not None and forex_meta.spread is not None:
            parts.append(f"Spread: {forex_meta.spread}")
        return parts
