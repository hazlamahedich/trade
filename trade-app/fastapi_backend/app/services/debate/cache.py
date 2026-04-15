import json
import logging

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)

ACTIVE_DEBATE_CACHE_KEY = "landing:active_debate"
ACTIVE_DEBATE_CACHE_TTL = 12


async def _get_redis() -> aioredis.Redis:
    return aioredis.from_url(settings.REDIS_URL, decode_responses=True)


async def get_cached_active_debate() -> dict | None:
    try:
        redis = await _get_redis()
        cached = await redis.get(ACTIVE_DEBATE_CACHE_KEY)
        await redis.aclose()
        if cached is not None:
            return json.loads(cached)
    except Exception as e:
        logger.warning(f"Redis cache read failed for active debate: {e}")
    return None


async def set_cached_active_debate(data: dict | None) -> None:
    try:
        redis = await _get_redis()
        await redis.set(
            ACTIVE_DEBATE_CACHE_KEY,
            json.dumps(data) if data is not None else "null",
            ex=ACTIVE_DEBATE_CACHE_TTL,
        )
        await redis.aclose()
    except Exception as e:
        logger.warning(f"Redis cache write failed for active debate: {e}")
