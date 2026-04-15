import json
import logging

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)

ACTIVE_DEBATE_CACHE_KEY = "landing:active_debate"
ACTIVE_DEBATE_CACHE_TTL = 12
NULL_SENTINEL = "__null_sentinel__"

_redis_pool: aioredis.Redis | None = None


async def _get_redis() -> aioredis.Redis:
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_pool


async def get_cached_active_debate() -> dict | None:
    redis = await _get_redis()
    try:
        cached = await redis.get(ACTIVE_DEBATE_CACHE_KEY)
        if cached is not None:
            if cached == NULL_SENTINEL:
                return NULL_SENTINEL
            return json.loads(cached)
    except Exception as e:
        logger.warning("Redis cache read failed for active debate: %s", e)
    return None


async def set_cached_active_debate(data: dict | None) -> None:
    redis = await _get_redis()
    try:
        if data is not None:
            await redis.set(
                ACTIVE_DEBATE_CACHE_KEY,
                json.dumps(data),
                ex=ACTIVE_DEBATE_CACHE_TTL,
            )
        else:
            await redis.set(
                ACTIVE_DEBATE_CACHE_KEY,
                NULL_SENTINEL,
                ex=ACTIVE_DEBATE_CACHE_TTL,
            )
    except Exception as e:
        logger.warning("Redis cache write failed for active debate: %s", e)
