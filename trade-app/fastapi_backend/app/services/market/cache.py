import json
import logging
from datetime import datetime
from typing import Any

from redis import asyncio as aioredis

from app.services.market.schemas import MarketData, NewsItem

logger = logging.getLogger(__name__)


class MarketDataCache:
    TTL_SECONDS = 60
    KEY_PREFIX = "market"

    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self._redis: aioredis.Redis | None = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(
                self.redis_url, encoding="utf-8", decode_responses=True
            )
        return self._redis

    async def close(self) -> None:
        if self._redis:
            await self._redis.close()
            self._redis = None

    def _price_key(self, asset: str) -> str:
        return f"{self.KEY_PREFIX}:{asset.lower()}:price"

    def _news_key(self, asset: str) -> str:
        return f"{self.KEY_PREFIX}:{asset.lower()}:news"

    async def get_price(self, asset: str) -> dict[str, Any] | None:
        redis = await self._get_redis()
        data = await redis.get(self._price_key(asset))
        if data:
            return json.loads(data)
        return None

    async def set_price(self, asset: str, price_data: dict[str, Any]) -> None:
        redis = await self._get_redis()
        await redis.setex(
            self._price_key(asset), self.TTL_SECONDS, json.dumps(price_data)
        )

    async def get_news(self, asset: str) -> list[dict[str, Any]] | None:
        redis = await self._get_redis()
        data = await redis.get(self._news_key(asset))
        if data:
            return json.loads(data)
        return None

    async def set_news(self, asset: str, news_data: list[dict[str, Any]]) -> None:
        redis = await self._get_redis()
        await redis.setex(
            self._news_key(asset), self.TTL_SECONDS, json.dumps(news_data)
        )

    async def get_cached_market_data(self, asset: str) -> MarketData | None:
        price_data = await self.get_price(asset)
        news_data = await self.get_news(asset)

        if price_data is None:
            return None

        news_items: list[NewsItem] = []
        if news_data:
            for item in news_data:
                news_items.append(
                    NewsItem(
                        title=item.get("title", ""),
                        url=item.get("url"),
                        source=item.get("source", "unknown"),
                        timestamp=datetime.fromisoformat(item["timestamp"])
                        if isinstance(item.get("timestamp"), str)
                        else datetime.utcnow(),
                    )
                )

        fetched_at = datetime.fromisoformat(price_data["fetched_at"])
        age_seconds = (datetime.utcnow() - fetched_at).total_seconds()

        return MarketData(
            asset=asset,
            price=price_data.get("price", 0.0),
            currency=price_data.get("currency", "usd"),
            news=news_items,
            is_stale=age_seconds > self.TTL_SECONDS,
            fetched_at=fetched_at,
        )

    async def set_market_data(self, asset: str, market_data: MarketData) -> None:
        price_data = {
            "price": market_data.price,
            "currency": market_data.currency,
            "fetched_at": market_data.fetched_at.isoformat(),
        }
        await self.set_price(asset, price_data)

        news_data = [
            {
                "title": news.title,
                "url": news.url,
                "source": news.source,
                "timestamp": news.timestamp.isoformat(),
            }
            for news in market_data.news
        ]
        await self.set_news(asset, news_data)

    def is_cache_valid(self, market_data: MarketData) -> bool:
        age_seconds = (datetime.utcnow() - market_data.fetched_at).total_seconds()
        return age_seconds <= self.TTL_SECONDS
