import json
import logging
from datetime import datetime, timezone

from redis import asyncio as aioredis

from app.services.market.schemas import FreshnessStatus

logger = logging.getLogger(__name__)


class StaleDataGuardian:
    KEY_PREFIX = "market"
    TIMESTAMP_SUFFIX = "price"

    def __init__(
        self,
        cache_redis_url: str,
        threshold_seconds: int = 60,
    ):
        self.cache_redis_url = cache_redis_url
        self.threshold_seconds = threshold_seconds
        self._redis: aioredis.Redis | None = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(
                self.cache_redis_url, encoding="utf-8", decode_responses=True
            )
        return self._redis

    async def close(self) -> None:
        if self._redis:
            await self._redis.close()
            self._redis = None

    def _timestamp_key(self, asset: str) -> str:
        return f"{self.KEY_PREFIX}:{asset.lower()}:{self.TIMESTAMP_SUFFIX}"

    async def _get_last_update(self, asset: str) -> tuple[datetime | None, str | None]:
        redis = await self._get_redis()
        data_str = await redis.get(self._timestamp_key(asset))
        if data_str is None:
            return None, None

        try:
            data = json.loads(data_str)
            fetched_at = data.get("fetched_at")
            if fetched_at:
                dt = datetime.fromisoformat(fetched_at)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt, data_str
        except (json.JSONDecodeError, ValueError, KeyError):
            pass
        return None, data_str

    async def is_data_stale(self, asset: str) -> bool:
        last_update, _ = await self._get_last_update(asset)
        if last_update is None:
            return True

        age_seconds = (datetime.now(timezone.utc) - last_update).total_seconds()
        return age_seconds > self.threshold_seconds

    async def check_data_freshness(self, asset: str) -> FreshnessStatus:
        last_update, _ = await self._get_last_update(asset)
        if last_update is None:
            return FreshnessStatus(
                asset=asset,
                is_stale=True,
                last_update=None,
                age_seconds=-1,
                threshold_seconds=self.threshold_seconds,
            )

        age_seconds = int((datetime.now(timezone.utc) - last_update).total_seconds())
        is_stale = age_seconds > self.threshold_seconds

        return FreshnessStatus(
            asset=asset,
            is_stale=is_stale,
            last_update=last_update,
            age_seconds=age_seconds,
            threshold_seconds=self.threshold_seconds,
        )

    async def get_freshness_status(self, asset: str) -> FreshnessStatus:
        return await self.check_data_freshness(asset)
