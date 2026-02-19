import json
from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest

from app.services.market.cache import MarketDataCache
from app.services.market.schemas import MarketData


class TestMarketDataCache:
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
    async def test_get_price_returns_none_when_not_cached(self, cache, mock_redis):
        mock_redis.get.return_value = None

        with patch.object(
            cache, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            result = await cache.get_price("BTC")

            assert result is None
            mock_redis.get.assert_called_once_with("market:btc:price")

    @pytest.mark.asyncio
    async def test_get_price_returns_data_when_cached(self, cache, mock_redis):
        cached_data = json.dumps(
            {"price": 45000.0, "fetched_at": datetime.utcnow().isoformat()}
        )
        mock_redis.get.return_value = cached_data

        with patch.object(
            cache, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            result = await cache.get_price("BTC")

            assert result is not None
            assert result["price"] == 45000.0

    @pytest.mark.asyncio
    async def test_set_price_stores_with_ttl(self, cache, mock_redis):
        price_data = {"price": 45000.0, "fetched_at": datetime.utcnow().isoformat()}

        with patch.object(
            cache, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            await cache.set_price("BTC", price_data)

            mock_redis.setex.assert_called_once()
            call_args = mock_redis.setex.call_args
            assert call_args[0][0] == "market:btc:price"
            assert call_args[0][1] == 60
            assert json.loads(call_args[0][2])["price"] == 45000.0

    @pytest.mark.asyncio
    async def test_get_cached_market_data_returns_none_when_no_price(
        self, cache, mock_redis
    ):
        mock_redis.get.return_value = None

        with patch.object(
            cache, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            result = await cache.get_cached_market_data("BTC")

            assert result is None

    @pytest.mark.asyncio
    async def test_get_cached_market_data_returns_data_with_news(
        self, cache, mock_redis
    ):
        price_data = json.dumps(
            {
                "price": 45000.0,
                "currency": "usd",
                "fetched_at": datetime.utcnow().isoformat(),
            }
        )
        news_data = json.dumps(
            [{"title": "Test News", "url": "https://example.com", "source": "test"}]
        )

        def mock_get(key):
            if "price" in key:
                return price_data
            return news_data

        mock_redis.get = AsyncMock(side_effect=mock_get)

        with patch.object(
            cache, "_get_redis", new_callable=AsyncMock
        ) as mock_get_redis:
            mock_get_redis.return_value = mock_redis
            result = await cache.get_cached_market_data("BTC")

            assert result is not None
            assert result.asset == "BTC"
            assert result.price == 45000.0
            assert len(result.news) == 1
            assert result.news[0].title == "Test News"

    @pytest.mark.asyncio
    async def test_is_cache_valid_returns_true_for_fresh_data(self, cache):
        market_data = MarketData(
            asset="BTC",
            price=45000.0,
            fetched_at=datetime.utcnow(),
        )

        assert cache.is_cache_valid(market_data) is True

    @pytest.mark.asyncio
    async def test_is_cache_valid_returns_false_for_stale_data(self, cache):
        from datetime import timedelta

        market_data = MarketData(
            asset="BTC",
            price=45000.0,
            fetched_at=datetime.utcnow() - timedelta(seconds=120),
        )

        assert cache.is_cache_valid(market_data) is False
