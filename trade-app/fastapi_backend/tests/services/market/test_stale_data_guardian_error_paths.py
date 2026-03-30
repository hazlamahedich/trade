import json
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from app.services.market.stale_data_guardian import StaleDataGuardian


class TestStaleDataGuardianErrorPaths:
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

    @pytest.mark.asyncio
    async def test_get_last_update_handles_invalid_json(self, guardian, mock_redis):
        mock_redis.get.return_value = "not valid json{"

        with patch.object(
            guardian, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            last_update, data_str = await guardian._get_last_update("BTC")

            assert last_update is None
            assert data_str == "not valid json{"

    @pytest.mark.asyncio
    async def test_get_last_update_handles_missing_fetched_at(
        self, guardian, mock_redis
    ):
        mock_redis.get.return_value = json.dumps({"price": 45000.0, "currency": "usd"})

        with patch.object(
            guardian, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            last_update, data_str = await guardian._get_last_update("BTC")

            assert last_update is None
            assert data_str is not None

    @pytest.mark.asyncio
    async def test_get_last_update_handles_naive_datetime(self, guardian, mock_redis):
        naive_dt = datetime.utcnow().isoformat()
        mock_redis.get.return_value = json.dumps(
            {"price": 45000.0, "fetched_at": naive_dt}
        )

        with patch.object(
            guardian, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            last_update, data_str = await guardian._get_last_update("BTC")

            assert last_update is not None
            assert last_update.tzinfo == timezone.utc

    @pytest.mark.asyncio
    async def test_get_last_update_handles_aware_datetime(self, guardian, mock_redis):
        aware_dt = datetime.now(timezone.utc).isoformat()
        mock_redis.get.return_value = json.dumps(
            {"price": 45000.0, "fetched_at": aware_dt}
        )

        with patch.object(
            guardian, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            last_update, data_str = await guardian._get_last_update("BTC")

            assert last_update is not None
            assert last_update.tzinfo == timezone.utc

    @pytest.mark.asyncio
    async def test_get_last_update_returns_none_when_no_redis_data(
        self, guardian, mock_redis
    ):
        mock_redis.get.return_value = None

        with patch.object(
            guardian, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            last_update, data_str = await guardian._get_last_update("BTC")

            assert last_update is None
            assert data_str is None

    @pytest.mark.asyncio
    async def test_is_data_stale_boundary_just_under_threshold(
        self, guardian, mock_redis
    ):
        just_under_dt = (datetime.now(timezone.utc) - timedelta(seconds=59)).isoformat()
        mock_redis.get.return_value = json.dumps(
            {"price": 45000.0, "fetched_at": just_under_dt}
        )

        with patch.object(
            guardian, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            result = await guardian.is_data_stale("BTC")

            assert result is False

    @pytest.mark.asyncio
    async def test_is_data_stale_boundary_just_over_threshold(
        self, guardian, mock_redis
    ):
        just_over_dt = (
            datetime.now(timezone.utc) - timedelta(seconds=60, microseconds=1)
        ).isoformat()
        mock_redis.get.return_value = json.dumps(
            {"price": 45000.0, "fetched_at": just_over_dt}
        )

        with patch.object(
            guardian, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            result = await guardian.is_data_stale("BTC")

            assert result is True

    @pytest.mark.asyncio
    async def test_close_clears_redis(self, guardian, mock_redis):
        guardian._redis = mock_redis

        await guardian.close()

        mock_redis.close.assert_called_once()
        assert guardian._redis is None

    @pytest.mark.asyncio
    async def test_close_when_no_redis(self, guardian):
        guardian._redis = None
        await guardian.close()
        assert guardian._redis is None

    def test_timestamp_key_format(self, guardian):
        key = guardian._timestamp_key("BTC")
        assert key == "market:btc:price"

        key = guardian._timestamp_key("ETH")
        assert key == "market:eth:price"
