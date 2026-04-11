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
    @pytest.mark.asyncio
    async def test_first_request_allowed(self):
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

    @pytest.mark.asyncio
    async def test_under_limit_allowed(self):
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

    @pytest.mark.asyncio
    async def test_at_limit_blocked(self):
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

    @pytest.mark.asyncio
    async def test_redis_failure_allows_request(self):
        with patch(
            "app.services.rate_limiter.get_redis_client",
            side_effect=Exception("Redis down"),
        ):
            limiter = RateLimiter(prefix="test", max_requests=5, window_seconds=60)
            result = await limiter.check("user_123")

            assert result.allowed is True
            assert result.remaining == 5

    @pytest.mark.asyncio
    async def test_reset(self):
        mock_redis = AsyncMock()
        mock_redis.delete = AsyncMock()

        with patch(
            "app.services.rate_limiter.get_redis_client", return_value=mock_redis
        ):
            limiter = RateLimiter(prefix="test", max_requests=5, window_seconds=60)
            await limiter.reset("user_123")

            mock_redis.delete.assert_called_once_with("test:user_123")

    @pytest.mark.asyncio
    async def test_reset_redis_failure(self):
        with patch(
            "app.services.rate_limiter.get_redis_client",
            side_effect=Exception("Redis down"),
        ):
            limiter = RateLimiter(prefix="test", max_requests=5, window_seconds=60)
            await limiter.reset("user_123")

    @pytest.mark.asyncio
    async def test_negative_ttl_sets_expiry(self):
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

    @pytest.mark.asyncio
    async def test_key_format(self):
        limiter = RateLimiter(prefix="vote_rate", max_requests=30, window_seconds=60)
        assert limiter._key("fp_abc") == "vote_rate:fp_abc"

    @pytest.mark.asyncio
    async def test_exact_at_limit_allowed(self):
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
    def test_debate_rate_limiter(self):
        limiter = create_debate_rate_limiter()
        assert limiter.prefix == "debate_rate"
        assert limiter.max_requests == 10
        assert limiter.window_seconds == 60

    def test_vote_rate_limiter(self):
        limiter = create_vote_rate_limiter()
        assert limiter.prefix == "vote_rate"
        assert limiter.max_requests == 30
        assert limiter.window_seconds == 60

    def test_ws_connection_rate_limiter(self):
        limiter = create_ws_connection_rate_limiter()
        assert limiter.prefix == "ws_rate"
        assert limiter.max_requests == 20
        assert limiter.window_seconds == 60

    def test_vote_capacity_limiter_uses_config(self):
        mock_settings = MagicMock()
        mock_settings.VOTE_CAPACITY_LIMIT = 5000

        with patch.dict(
            "sys.modules", {"app.config": MagicMock(settings=mock_settings)}
        ):
            with patch("app.config.settings", mock_settings):
                limiter = create_vote_capacity_limiter()
                assert limiter.prefix == "capacity:active_voters"
                assert limiter.max_requests == 5000
                assert limiter.window_seconds == 60


class TestRateLimitResult:
    def test_frozen(self):
        result = RateLimitResult(
            allowed=True, current=1, limit=5, remaining=4, reset_at=time.time()
        )
        with pytest.raises(AttributeError):
            result.allowed = False
