import json
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch

from app.services.market.stale_data_guardian import StaleDataGuardian
from app.services.market.schemas import FreshnessStatus


def _make_price_data(timestamp: datetime) -> str:
    return json.dumps(
        {
            "price": 45000.0,
            "currency": "usd",
            "fetched_at": timestamp.isoformat(),
        }
    )


class TestStaleDataGuardian:
    @pytest.fixture
    def guardian(self):
        return StaleDataGuardian(
            cache_redis_url="redis://localhost:6379/0",
            threshold_seconds=60,
        )

    @pytest.fixture
    def mock_redis(self):
        redis_mock = AsyncMock()
        redis_mock.get = AsyncMock()
        redis_mock.close = AsyncMock()
        return redis_mock

    def test_threshold_defaults_to_60(self):
        guardian = StaleDataGuardian(cache_redis_url="redis://localhost:6379/0")
        assert guardian.threshold_seconds == 60

    def test_custom_threshold(self):
        guardian = StaleDataGuardian(
            cache_redis_url="redis://localhost:6379/0", threshold_seconds=30
        )
        assert guardian.threshold_seconds == 30

    @pytest.mark.asyncio
    async def test_is_data_stale_returns_true_when_old(self, guardian, mock_redis):
        mock_redis.get.return_value = _make_price_data(
            datetime.utcnow() - timedelta(seconds=120)
        )

        with patch.object(
            guardian, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            result = await guardian.is_data_stale("BTC")

            assert result is True

    @pytest.mark.asyncio
    async def test_is_data_stale_returns_false_when_fresh(self, guardian, mock_redis):
        mock_redis.get.return_value = _make_price_data(datetime.utcnow())

        with patch.object(
            guardian, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            result = await guardian.is_data_stale("BTC")

            assert result is False

    @pytest.mark.asyncio
    async def test_is_data_stale_returns_true_when_no_data(self, guardian, mock_redis):
        mock_redis.get.return_value = None

        with patch.object(
            guardian, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            result = await guardian.is_data_stale("BTC")

            assert result is True

    @pytest.mark.asyncio
    async def test_check_data_freshness_returns_stale_status(
        self, guardian, mock_redis
    ):
        mock_redis.get.return_value = _make_price_data(
            datetime.utcnow() - timedelta(seconds=75)
        )

        with patch.object(
            guardian, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            result = await guardian.check_data_freshness("BTC")

            assert result.is_stale is True
            assert result.age_seconds >= 60
            assert result.asset == "BTC"

    @pytest.mark.asyncio
    async def test_check_data_freshness_returns_fresh_status(
        self, guardian, mock_redis
    ):
        mock_redis.get.return_value = _make_price_data(datetime.utcnow())

        with patch.object(
            guardian, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            result = await guardian.check_data_freshness("BTC")

            assert result.is_stale is False
            assert result.asset == "BTC"

    @pytest.mark.asyncio
    async def test_check_data_freshness_returns_stale_when_no_data(
        self, guardian, mock_redis
    ):
        mock_redis.get.return_value = None

        with patch.object(
            guardian, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            result = await guardian.check_data_freshness("BTC")

            assert result.is_stale is True
            assert result.age_seconds == -1

    @pytest.mark.asyncio
    async def test_get_freshness_status_returns_complete_object(
        self, guardian, mock_redis
    ):
        mock_redis.get.return_value = _make_price_data(datetime.utcnow())

        with patch.object(
            guardian, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            result = await guardian.get_freshness_status("BTC")

            assert isinstance(result, FreshnessStatus)
            assert result.asset == "BTC"
            assert result.threshold_seconds == 60
            assert isinstance(result.last_update, datetime)
            assert result.age_seconds >= 0
