import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import time

from app.services.rate_limiter import (
    RateLimiter,
    RateLimitResult,
    create_debate_rate_limiter,
    create_vote_rate_limiter,
    create_vote_capacity_limiter,
    create_ws_connection_rate_limiter,
)


class TestRateLimiter:
    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_first_request_allowed(self):
        """[3-1-RL-001] Given first request, When rate check, Then allowed with remaining=4"""
        mock_redis = AsyncMock()
        mock_pipeline = AsyncMock()
        mock_pipeline.incr = MagicMock(return_value=mock_pipeline)
        mock_pipeline.ttl = MagicMock(return_value=mock_pipeline)
        mock_pipeline.execute = AsyncMock(return_value=[1, -2])
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)
        mock_redis.expire = AsyncMock()

        with patch(
            "app.services.rate_limiter.get_redis_client", return_value=mock_redis
        ):
            limiter = RateLimiter(prefix="test", max_requests=5, window_seconds=60)
            result = await limiter.check("user_123")

            assert result.allowed is True
            assert result.current == 1
            assert result.remaining == 4
            assert result.limit == 5

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_under_limit_allowed(self):
        """[3-1-RL-002] Given current=3 limit=5, When rate check, Then allowed with remaining=2"""
        mock_redis = AsyncMock()
        mock_pipeline = AsyncMock()
        mock_pipeline.incr = MagicMock(return_value=mock_pipeline)
        mock_pipeline.ttl = MagicMock(return_value=mock_pipeline)
        mock_pipeline.execute = AsyncMock(return_value=[3, 45])
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)

        with patch(
            "app.services.rate_limiter.get_redis_client", return_value=mock_redis
        ):
            limiter = RateLimiter(prefix="test", max_requests=5, window_seconds=60)
            result = await limiter.check("user_123")

            assert result.allowed is True
            assert result.current == 3
            assert result.remaining == 2

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_at_limit_blocked(self):
        """[3-1-RL-003] Given current=6 limit=5, When rate check, Then blocked"""
        mock_redis = AsyncMock()
        mock_pipeline = AsyncMock()
        mock_pipeline.incr = MagicMock(return_value=mock_pipeline)
        mock_pipeline.ttl = MagicMock(return_value=mock_pipeline)
        mock_pipeline.execute = AsyncMock(return_value=[6, 30])
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)

        with patch(
            "app.services.rate_limiter.get_redis_client", return_value=mock_redis
        ):
            limiter = RateLimiter(prefix="test", max_requests=5, window_seconds=60)
            result = await limiter.check("user_123")

            assert result.allowed is False
            assert result.current == 6
            assert result.remaining == 0

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_redis_failure_allows_request(self):
        """[3-1-RL-004] Given Redis down, When rate check, Then allowed (fail-open)"""
        with patch(
            "app.services.rate_limiter.get_redis_client",
            side_effect=Exception("Redis down"),
        ):
            limiter = RateLimiter(prefix="test", max_requests=5, window_seconds=60)
            result = await limiter.check("user_123")

            assert result.allowed is True
            assert result.remaining == 5

    @pytest.mark.p2
    @pytest.mark.asyncio
    async def test_reset(self):
        """[3-1-RL-005] Given valid key, When reset called, Then Redis delete called"""
        mock_redis = AsyncMock()
        mock_redis.delete = AsyncMock()

        with patch(
            "app.services.rate_limiter.get_redis_client", return_value=mock_redis
        ):
            limiter = RateLimiter(prefix="test", max_requests=5, window_seconds=60)
            await limiter.reset("user_123")

            mock_redis.delete.assert_called_once_with("test:user_123")

    @pytest.mark.p2
    @pytest.mark.asyncio
    async def test_reset_redis_failure(self):
        """[3-1-RL-006] Given Redis down, When reset called, Then no exception"""
        with patch(
            "app.services.rate_limiter.get_redis_client",
            side_effect=Exception("Redis down"),
        ):
            limiter = RateLimiter(prefix="test", max_requests=5, window_seconds=60)
            await limiter.reset("user_123")

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_negative_ttl_sets_expiry(self):
        """[3-1-RL-007] Given negative TTL, When rate check, Then expiry set on key"""
        mock_redis = AsyncMock()
        mock_pipeline = AsyncMock()
        mock_pipeline.incr = MagicMock(return_value=mock_pipeline)
        mock_pipeline.ttl = MagicMock(return_value=mock_pipeline)
        mock_pipeline.execute = AsyncMock(return_value=[2, -1])
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)
        mock_redis.expire = AsyncMock()

        with patch(
            "app.services.rate_limiter.get_redis_client", return_value=mock_redis
        ):
            limiter = RateLimiter(prefix="test", max_requests=5, window_seconds=60)
            result = await limiter.check("user_123")

            assert result.allowed is True
            mock_redis.expire.assert_called_once()

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_key_format(self):
        """[3-1-RL-008] Given prefix and identifier, When key built, Then format is prefix:id"""
        limiter = RateLimiter(prefix="vote_rate", max_requests=10, window_seconds=60)
        assert limiter._key("fp_abc") == "vote_rate:fp_abc"

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_exact_at_limit_allowed(self):
        """[3-1-RL-009] Given current=5 limit=5, When rate check, Then allowed (at limit ok)"""
        mock_redis = AsyncMock()
        mock_pipeline = AsyncMock()
        mock_pipeline.incr = MagicMock(return_value=mock_pipeline)
        mock_pipeline.ttl = MagicMock(return_value=mock_pipeline)
        mock_pipeline.execute = AsyncMock(return_value=[5, 30])
        mock_pipeline.__aenter__ = AsyncMock(return_value=mock_pipeline)
        mock_pipeline.__aexit__ = AsyncMock(return_value=None)
        mock_redis.pipeline = MagicMock(return_value=mock_pipeline)

        with patch(
            "app.services.rate_limiter.get_redis_client", return_value=mock_redis
        ):
            limiter = RateLimiter(prefix="test", max_requests=5, window_seconds=60)
            result = await limiter.check("user_123")

            assert result.allowed is True
            assert result.current == 5
            assert result.remaining == 0


class TestRateLimiterFactories:
    @pytest.mark.p1
    def test_debate_rate_limiter(self):
        """[3-1-RL-010] Given debate factory, When created, Then prefix=debate_rate limit=10"""
        limiter = create_debate_rate_limiter()
        assert limiter.prefix == "debate_rate"
        assert limiter.max_requests == 10
        assert limiter.window_seconds == 60

    @pytest.mark.p1
    def test_vote_rate_limiter(self):
        """[3-1-RL-011] Given vote factory, When created, Then prefix=vote_rate limit=10"""
        limiter = create_vote_rate_limiter()
        assert limiter.prefix == "vote_rate"
        assert limiter.max_requests == 10
        assert limiter.window_seconds == 60

    @pytest.mark.p1
    def test_ws_connection_rate_limiter(self):
        """[3-1-RL-012] Given ws factory, When created, Then prefix=ws_rate limit=20"""
        limiter = create_ws_connection_rate_limiter()
        assert limiter.prefix == "ws_rate"
        assert limiter.max_requests == 20
        assert limiter.window_seconds == 60

    @pytest.mark.p0
    def test_vote_capacity_limiter_uses_config(self):
        """[3-1-RL-013] Given VOTE_CAPACITY_LIMIT=5000, When capacity factory, Then limit=5000"""
        mock_settings = MagicMock()
        mock_settings.VOTE_CAPACITY_LIMIT = 5000

        with patch.dict(
            "sys.modules", {"app.config": MagicMock(settings=mock_settings)}
        ):
            with patch("app.config.settings", mock_settings):
                limiter = create_vote_capacity_limiter()
                assert limiter.prefix == "capacity:unique_voters"
                assert limiter.max_voters == 5000
                assert limiter.ttl_seconds == 300


class TestRateLimitResult:
    @pytest.mark.p2
    def test_frozen(self):
        """[3-1-RL-014] Given RateLimitResult, When field modified, Then AttributeError raised"""
        result = RateLimitResult(
            allowed=True, current=1, limit=5, remaining=4, reset_at=time.time()
        )
        with pytest.raises(AttributeError):
            result.allowed = False


class TestRateLimiterRelease:
    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_release_decrements_counter(self):
        """[3-1-RL-015] Given valid key, When release called, Then Redis DECR called"""
        mock_redis = AsyncMock()
        mock_redis.decr = AsyncMock(return_value=4)

        with patch(
            "app.services.rate_limiter.get_redis_client", return_value=mock_redis
        ):
            limiter = RateLimiter(prefix="test", max_requests=5, window_seconds=60)
            await limiter.release("user_123")

            mock_redis.decr.assert_called_once_with("test:user_123")

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_release_deletes_key_on_negative(self):
        """[3-1-RL-016] Given counter goes negative, When release, Then key deleted (safety net)"""
        mock_redis = AsyncMock()
        mock_redis.decr = AsyncMock(return_value=-1)
        mock_redis.delete = AsyncMock()

        with patch(
            "app.services.rate_limiter.get_redis_client", return_value=mock_redis
        ):
            limiter = RateLimiter(prefix="test", max_requests=5, window_seconds=60)
            await limiter.release("user_123")

            mock_redis.decr.assert_called_once_with("test:user_123")
            mock_redis.delete.assert_called_once_with("test:user_123")

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_release_redis_failure_no_exception(self):
        """[3-1-RL-017] Given Redis down, When release called, Then no exception raised"""
        with patch(
            "app.services.rate_limiter.get_redis_client",
            side_effect=Exception("Redis down"),
        ):
            limiter = RateLimiter(prefix="test", max_requests=5, window_seconds=60)
            await limiter.release("user_123")


class TestConcurrentLimiterInit:
    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_concurrent_vote_limiter_init_no_double_create(self):
        """[3-1-RL-018] Given two concurrent first-access calls, When _get_vote_limiter, Then single instance returned"""
        import asyncio
        import app.routes.debate as debate_module

        debate_module._vote_limiter = None

        async def get_limiter():
            return debate_module._get_vote_limiter()

        results = await asyncio.gather(get_limiter(), get_limiter())
        assert results[0] is results[1]

        debate_module._vote_limiter = None

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_concurrent_capacity_limiter_init_no_double_create(self):
        """[3-1-RL-019] Given two concurrent first-access calls, When _get_capacity_limiter, Then single instance returned"""
        import asyncio
        import app.routes.debate as debate_module

        debate_module._capacity_limiter = None

        async def get_limiter():
            return debate_module._get_capacity_limiter()

        results = await asyncio.gather(get_limiter(), get_limiter())
        assert results[0] is results[1]

        debate_module._capacity_limiter = None


class TestCapacitySemantics:
    @pytest.mark.skip(
        "Awaiting product decision: measure unique voters vs vote throughput"
    )
    @pytest.mark.p0
    @pytest.mark.parametrize(
        "scenario,expected_votes_counted",
        [
            ("same_user_two_debates", 2),
            ("same_user_same_debate_twice", 1),
            ("two_users_same_debate", 2),
            ("at_capacity_repeat_submitter_blocked", "blocked"),
        ],
    )
    @pytest.mark.asyncio
    async def test_capacity_semantics(self, scenario, expected_votes_counted):
        """[3-1-RL-020] DESIGN DECISION: capacity tracks [unique voters | vote events] — parameterized to document decision"""
        pass
