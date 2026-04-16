import logging
import time
import uuid
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
    capacity_member: str | None = None


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

    async def release(self, identifier: str) -> None:
        try:
            redis = await get_redis_client()
            key = self._key(identifier)
            current = await redis.decr(key)
            if current < 0:
                await redis.delete(key)
        except Exception as e:
            logger.warning(f"Redis rate limit release failed: {e}")

    async def reset(self, identifier: str) -> None:
        try:
            redis = await get_redis_client()
            await redis.delete(self._key(identifier))
        except Exception as e:
            logger.warning(f"Redis rate limit reset failed: {e}")


class UniqueVoterCapacityLimiter:
    """
    Tracks unique active voters using Redis SET + SADD/SCARD.

    Unlike RateLimiter (which counts total requests in a sliding window),
    this measures concurrent unique voters — the correct metric for
    capacity planning (NFR-04).
    """

    def __init__(
        self,
        prefix: str = "capacity:unique_voters",
        max_voters: int = 10_000,
        ttl_seconds: int = 300,
    ):
        self.prefix = prefix
        self.max_voters = max_voters
        self.ttl_seconds = ttl_seconds

    def _key(self, identifier: str) -> str:
        return f"{self.prefix}:{identifier}"

    async def check(self, identifier: str) -> RateLimitResult:
        member = uuid.uuid4().hex
        try:
            redis = await get_redis_client()
            key = self._key(identifier)
            now = time.time()

            await redis.sadd(key, member)
            current = await redis.scard(key)
            await redis.expire(key, self.ttl_seconds)

            allowed = current <= self.max_voters
            remaining = max(0, self.max_voters - current)

            if not allowed:
                await redis.srem(key, member)

            return RateLimitResult(
                allowed=allowed,
                current=current,
                limit=self.max_voters,
                remaining=remaining if allowed else 0,
                reset_at=now + self.ttl_seconds,
                capacity_member=member,
            )
        except Exception as e:
            logger.warning(
                f"Redis unique voter capacity check failed, allowing request: {e}"
            )
            return RateLimitResult(
                allowed=True,
                current=0,
                limit=self.max_voters,
                remaining=self.max_voters,
                reset_at=time.time() + self.ttl_seconds,
                capacity_member=member,
            )

    async def release(self, identifier: str, member: str | None = None) -> None:
        if not member:
            return
        try:
            redis = await get_redis_client()
            await redis.srem(self._key(identifier), member)
        except Exception as e:
            logger.warning(f"Redis unique voter capacity release failed: {e}")

    async def reset(self, identifier: str) -> None:
        try:
            redis = await get_redis_client()
            await redis.delete(self._key(identifier))
        except Exception as e:
            logger.warning(f"Redis unique voter capacity reset failed: {e}")


def create_debate_rate_limiter() -> RateLimiter:
    return RateLimiter(
        prefix="debate_rate",
        max_requests=10,
        window_seconds=60,
    )


def create_vote_rate_limiter() -> RateLimiter:
    return RateLimiter(
        prefix="vote_rate",
        max_requests=10,
        window_seconds=60,
    )


def create_vote_capacity_limiter() -> UniqueVoterCapacityLimiter:
    from app.config import settings

    return UniqueVoterCapacityLimiter(
        prefix="capacity:unique_voters",
        max_voters=settings.VOTE_CAPACITY_LIMIT,
        ttl_seconds=300,
    )


def create_ws_connection_rate_limiter() -> RateLimiter:
    return RateLimiter(
        prefix="ws_rate",
        max_requests=20,
        window_seconds=60,
    )
