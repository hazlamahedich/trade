import logging
import time
from datetime import datetime
from typing import Any

from app.config import settings
from app.services.market.cache import MarketDataCache
from app.services.market.provider import YFinanceProvider
from app.services.market.schemas import MarketContext, MarketData, MarketMeta, NewsItem

logger = logging.getLogger(__name__)


class MarketDataService:
    def __init__(self, redis_url: str | None = None):
        self.redis_url = redis_url or settings.REDIS_URL
        self.cache = MarketDataCache(self.redis_url)
        self.provider = YFinanceProvider()

    async def close(self) -> None:
        await self.cache.close()
        await self.provider.close()

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

        tech_data = await self.provider.fetch_technical(asset)

        extra_parts = []
        if tech_data:
            if tech_data.get("change24h") is not None:
                extra_parts.append(f"24h change: {tech_data['change24h']}%")
            if tech_data.get("change7d") is not None:
                extra_parts.append(f"7d change: {tech_data['change7d']}%")
            if tech_data.get("rsi14") is not None:
                extra_parts.append(f"RSI(14): {tech_data['rsi14']}")
            if tech_data.get("sma20"):
                extra_parts.append(f"SMA20: ${tech_data['sma20']:,.2f}")
            if tech_data.get("supportLevels"):
                supports = ", ".join(f"${s:,.2f}" for s in tech_data["supportLevels"])
                extra_parts.append(f"Support levels: {supports}")
            if tech_data.get("resistanceLevels"):
                resistances = ", ".join(
                    f"${r:,.2f}" for r in tech_data["resistanceLevels"]
                )
                extra_parts.append(f"Resistance levels: {resistances}")
            if tech_data.get("volumeRatio"):
                extra_parts.append(
                    f"Volume ratio vs 20d avg: {tech_data['volumeRatio']}x"
                )

        return MarketContext(
            asset=data.asset,
            price=data.price,
            news_summary=[n.title for n in data.news[:3]] + extra_parts,
            is_stale=data.is_stale,
        )
