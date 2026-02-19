import logging
import time
from datetime import datetime
from typing import Any

from app.config import settings
from app.services.market.cache import MarketDataCache
from app.services.market.provider import (
    CoinGeckoProvider,
    YahooFinanceProvider,
)
from app.services.market.schemas import MarketContext, MarketData, MarketMeta, NewsItem

logger = logging.getLogger(__name__)


class MarketDataService:
    def __init__(self, redis_url: str | None = None):
        self.redis_url = redis_url or settings.REDIS_URL
        self.cache = MarketDataCache(self.redis_url)
        self.coingecko = CoinGeckoProvider(self.redis_url)
        self.yahoo = YahooFinanceProvider()

    async def close(self) -> None:
        await self.cache.close()
        await self.coingecko.close()
        await self.yahoo.close()

    async def get_data(
        self,
        asset: str,
        mock_providers_down: bool = False,
        mock_no_cache: bool = False,
    ) -> tuple[MarketData | None, MarketMeta]:
        start_time = time.time()
        provider_used: str | None = None

        cached_data = (
            None
            if mock_no_cache
            else await self.cache.get_cached_market_data(asset)
        )

        if cached_data and self.cache.is_cache_valid(cached_data) and not mock_providers_down:
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

        price_data: dict[str, Any] | None = None
        news_data: list[NewsItem] = []

        price_data = await self.coingecko.fetch_price(asset)
        if price_data:
            provider_used = self.coingecko.get_name()
            news_data = await self.coingecko.fetch_news(asset)

        if not price_data:
            price_data = await self.yahoo.fetch_price(asset)
            if price_data:
                provider_used = self.yahoo.get_name()

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
                latency_ms=latency_ms, provider=provider_used
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
        return MarketContext(
            asset=data.asset,
            price=data.price,
            news_summary=[n.title for n in data.news[:3]],
            is_stale=data.is_stale,
        )
