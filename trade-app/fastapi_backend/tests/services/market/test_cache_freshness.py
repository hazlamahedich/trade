import json
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest

from app.services.market.cache import MarketDataCache


class TestMarketDataCacheFreshness:
    @pytest.fixture
    def cache(self):
        return MarketDataCache("redis://localhost:6379/0")

    @pytest.fixture
    def mock_redis(self):
        redis_mock = AsyncMock()
        redis_mock.get = AsyncMock()
        redis_mock.setex = AsyncMock()
        redis_mock.close = AsyncMock()
        return redis_mock

    @pytest.mark.asyncio
    async def test_get_with_timestamp_returns_none_when_not_cached(
        self, cache, mock_redis
    ):
        mock_redis.get.return_value = None

        with patch.object(
            cache, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            result = await cache.get_with_timestamp("BTC")

            assert result is None

    @pytest.mark.asyncio
    async def test_get_with_timestamp_returns_data_and_timestamp(
        self, cache, mock_redis
    ):
        now = datetime.utcnow()
        price_data = json.dumps(
            {
                "price": 45000.0,
                "currency": "usd",
                "fetched_at": now.isoformat(),
            }
        )
        mock_redis.get.return_value = price_data

        with patch.object(
            cache, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            result = await cache.get_with_timestamp("BTC")

            assert result is not None
            assert "data" in result
            assert "fetched_at" in result
            assert result["data"]["price"] == 45000.0

    @pytest.mark.asyncio
    async def test_get_with_timestamp_returns_freshness_status(self, cache, mock_redis):
        now = datetime.utcnow()
        price_data = json.dumps(
            {
                "price": 45000.0,
                "currency": "usd",
                "fetched_at": now.isoformat(),
            }
        )
        mock_redis.get.return_value = price_data

        with patch.object(
            cache, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            result = await cache.get_with_timestamp("BTC")

            assert result is not None
            assert "freshness_status" in result
            assert result["freshness_status"].asset == "BTC"
            assert result["freshness_status"].is_stale is False

    @pytest.mark.asyncio
    async def test_get_with_timestamp_detects_stale_data(self, cache, mock_redis):
        old_time = datetime.utcnow() - timedelta(seconds=120)
        price_data = json.dumps(
            {
                "price": 45000.0,
                "currency": "usd",
                "fetched_at": old_time.isoformat(),
            }
        )
        mock_redis.get.return_value = price_data

        with patch.object(
            cache, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            result = await cache.get_with_timestamp("BTC")

            assert result is not None
            assert result["freshness_status"].is_stale is True
