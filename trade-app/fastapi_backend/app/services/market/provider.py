import asyncio
import logging
import time
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

import aiohttp
from redis import asyncio as aioredis

from app.services.market.schemas import NewsItem

logger = logging.getLogger(__name__)

ASSET_IDS: dict[str, dict[str, str]] = {
    "BTC": {"coingecko": "bitcoin", "yahoo": "BTC-USD"},
    "ETH": {"coingecko": "ethereum", "yahoo": "ETH-USD"},
    "SOL": {"coingecko": "solana", "yahoo": "SOL-USD"},
}

SUPPORTED_ASSETS: set[str] = {"BTC", "ETH", "SOL", "bitcoin", "ethereum", "solana"}


def normalize_asset(asset: str) -> str | None:
    """Normalize asset name to uppercase symbol. Returns None if unsupported."""
    asset_lower = asset.lower()
    mapping = {
        "bitcoin": "BTC",
        "ethereum": "ETH",
        "solana": "SOL",
        "btc": "BTC",
        "eth": "ETH",
        "sol": "SOL",
    }
    return mapping.get(asset_lower)


class RateLimiter:
    KEY = "market:rate_limit:coingecko"
    MAX_CALLS = 30
    WINDOW_SEC = 60

    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self._redis: aioredis.Redis | None = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(
                self.redis_url, encoding="utf-8", decode_responses=True
            )
        return self._redis

    async def acquire(self) -> bool:
        redis = await self._get_redis()
        current = await redis.incr(self.KEY)
        if current == 1:
            await redis.expire(self.KEY, self.WINDOW_SEC)
        return current <= self.MAX_CALLS

    async def close(self) -> None:
        if self._redis:
            await self._redis.close()
            self._redis = None


class DataProvider(ABC):
    @abstractmethod
    async def fetch_price(self, asset: str) -> dict[str, Any] | None:
        pass

    @abstractmethod
    async def fetch_news(self, asset: str) -> list[NewsItem]:
        pass

    @abstractmethod
    def get_name(self) -> str:
        pass


class CoinGeckoProvider(DataProvider):
    BASE_URL = "https://api.coingecko.com/api/v3"
    TIMEOUT = 10

    def __init__(self, redis_url: str):
        self.rate_limiter = RateLimiter(redis_url)
        self._session: aiohttp.ClientSession | None = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=self.TIMEOUT)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()
        await self.rate_limiter.close()

    def get_name(self) -> str:
        return "coingecko"

    def _get_asset_id(self, asset: str) -> str | None:
        normalized = normalize_asset(asset)
        if normalized and normalized in ASSET_IDS:
            return ASSET_IDS[normalized]["coingecko"]
        return None

    async def fetch_price(self, asset: str) -> dict[str, Any] | None:
        can_proceed = await self.rate_limiter.acquire()
        if not can_proceed:
            logger.warning(f"Rate limit exceeded for CoinGecko, asset: {asset}")
            return None

        coin_id = self._get_asset_id(asset)
        if not coin_id:
            return None

        session = await self._get_session()
        url = f"{self.BASE_URL}/simple/price"
        params = {
            "ids": coin_id,
            "vs_currencies": "usd",
            "include_last_updated_at": "true",
        }

        try:
            async with session.get(url, params=params) as response:
                if response.status != 200:
                    logger.error(f"CoinGecko API error: {response.status}")
                    return None
                data = await response.json()
                if coin_id in data:
                    return {
                        "price": data[coin_id].get("usd"),
                        "last_updated": data[coin_id].get("last_updated_at"),
                    }
                return None
        except asyncio.TimeoutError:
            logger.error(f"CoinGecko request timed out for asset: {asset}")
            return None
        except Exception as e:
            logger.error(f"CoinGecko fetch_price error: {e}")
            return None

    async def fetch_news(self, asset: str) -> list[NewsItem]:
        can_proceed = await self.rate_limiter.acquire()
        if not can_proceed:
            logger.warning(f"Rate limit exceeded for CoinGecko news, asset: {asset}")
            return []

        coin_id = self._get_asset_id(asset)
        if not coin_id:
            return []

        session = await self._get_session()
        url = f"{self.BASE_URL}/status_updates"
        params = {"category": "general", "project_ids": coin_id, "per_page": "5"}

        try:
            async with session.get(url, params=params) as response:
                if response.status != 200:
                    logger.error(f"CoinGecko news API error: {response.status}")
                    return []
                data = await response.json()
                news_items: list[NewsItem] = []
                for item in data.get("status_updates", []):
                    timestamp: datetime
                    created_at_str = item.get("created_at")
                    if created_at_str:
                        try:
                            timestamp = datetime.fromisoformat(
                                created_at_str.replace("Z", "+00:00")
                            )
                        except (ValueError, TypeError) as parse_err:
                            logger.warning(
                                f"Failed to parse timestamp '{created_at_str}': {parse_err}"
                            )
                            timestamp = datetime.utcnow()
                    else:
                        timestamp = datetime.utcnow()
                    news_items.append(
                        NewsItem(
                            title=item.get("description", "")[:200],
                            url=item.get("permalink"),
                            source="coingecko",
                            timestamp=timestamp,
                        )
                    )
                return news_items
        except asyncio.TimeoutError:
            logger.error(f"CoinGecko news request timed out for asset: {asset}")
            return []
        except Exception as e:
            logger.error(f"CoinGecko fetch_news error: {e}")
            return []


class YahooFinanceProvider(DataProvider):
    BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart"
    TIMEOUT = 10

    def __init__(self):
        self._session: aiohttp.ClientSession | None = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=self.TIMEOUT)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    def get_name(self) -> str:
        return "yahoo"

    def _get_asset_id(self, asset: str) -> str | None:
        normalized = normalize_asset(asset)
        if normalized and normalized in ASSET_IDS:
            return ASSET_IDS[normalized]["yahoo"]
        return None

    async def fetch_price(self, asset: str) -> dict[str, Any] | None:
        symbol = self._get_asset_id(asset)
        if not symbol:
            return None

        session = await self._get_session()
        url = f"{self.BASE_URL}/{symbol}"
        params = {"interval": "1d", "range": "1d"}

        try:
            async with session.get(url, params=params) as response:
                if response.status != 200:
                    logger.error(f"Yahoo Finance API error: {response.status}")
                    return None
                data = await response.json()
                result = data.get("chart", {}).get("result", [])
                if result:
                    meta = result[0].get("meta", {})
                    return {
                        "price": meta.get("regularMarketPrice"),
                        "last_updated": time.time(),
                    }
                return None
        except asyncio.TimeoutError:
            logger.error(f"Yahoo Finance request timed out for asset: {asset}")
            return None
        except Exception as e:
            logger.error(f"Yahoo Finance fetch_price error: {e}")
            return None

    async def fetch_news(self, asset: str) -> list[NewsItem]:
        return []
