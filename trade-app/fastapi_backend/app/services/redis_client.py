import logging
from redis import asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)

_redis_client: aioredis.Redis | None = None


async def get_redis_client() -> aioredis.Redis:
    """Get or create a shared async Redis client singleton."""
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL, encoding="utf-8", decode_responses=True
        )
    return _redis_client


async def close_redis_client() -> None:
    """Close the shared Redis client."""
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None
