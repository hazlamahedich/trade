import logging
import time
from dataclasses import dataclass

from app.services.redis_client import get_redis_client

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    current: int
    limit: int
    remaining: int
    reset_at: float


class RateLimiter:
    def __init__(
        self,
        prefix: str = "rate_limit",
        max_requests: int = 60,
        window_seconds: int = 60,
    ):
        self.prefix = prefix
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    def _key(self, identifier: str) -> str:
        return f"{self.prefix}:{identifier}"

    async def check(self, identifier: str) -> RateLimitResult:
        try:
            redis = await get_redis_client()
            key = self._key(identifier)
            now = time.time()

            async with redis.pipeline(transaction=True) as pipe:
                pipe.incr(key)
                pipe.ttl(key)
                results = await pipe.execute()

            current = results[0]
            ttl = results[1]

            if current == 1:
                await redis.expire(key, self.window_seconds)
                reset_at = now + self.window_seconds
            elif ttl > 0:
                reset_at = now + ttl
            else:
                await redis.expire(key, self.window_seconds)
                reset_at = now + self.window_seconds

            allowed = current <= self.max_requests
            remaining = max(0, self.max_requests - current)

            return RateLimitResult(
                allowed=allowed,
                current=current,
                limit=self.max_requests,
                remaining=remaining if allowed else 0,
                reset_at=reset_at,
            )
        except Exception as e:
            logger.warning(f"Redis rate limit check failed, allowing request: {e}")
            return RateLimitResult(
                allowed=True,
                current=0,
                limit=self.max_requests,
                remaining=self.max_requests,
                reset_at=time.time() + self.window_seconds,
            )

    async def reset(self, identifier: str) -> None:
        try:
            redis = await get_redis_client()
            await redis.delete(self._key(identifier))
        except Exception as e:
            logger.warning(f"Redis rate limit reset failed: {e}")


def create_debate_rate_limiter() -> RateLimiter:
    return RateLimiter(
        prefix="debate_rate",
        max_requests=10,
        window_seconds=60,
    )


def create_vote_rate_limiter() -> RateLimiter:
    return RateLimiter(
        prefix="vote_rate",
        max_requests=30,
        window_seconds=60,
    )


def create_ws_connection_rate_limiter() -> RateLimiter:
    return RateLimiter(
        prefix="ws_rate",
        max_requests=20,
        window_seconds=60,
    )
