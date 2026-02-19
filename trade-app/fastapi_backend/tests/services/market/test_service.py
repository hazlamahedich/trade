from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.market import MarketDataService
from app.services.market.schemas import MarketData, NewsItem


class TestMarketDataService:
    @pytest.fixture
    def service(self):
        return MarketDataService("redis://localhost:6379/0")

    @pytest.fixture
    def mock_cache(self):
        cache_mock = MagicMock()
        cache_mock.get_cached_market_data = AsyncMock(return_value=None)
        cache_mock.set_market_data = AsyncMock()
        cache_mock.is_cache_valid = MagicMock(return_value=False)
        cache_mock.close = AsyncMock()
        return cache_mock

    @pytest.fixture
    def mock_coingecko(self):
        provider_mock = MagicMock()
        provider_mock.fetch_price = AsyncMock()
        provider_mock.fetch_news = AsyncMock(return_value=[])
        provider_mock.get_name = MagicMock(return_value="coingecko")
        provider_mock.close = AsyncMock()
        return provider_mock

    @pytest.fixture
    def mock_yahoo(self):
        provider_mock = MagicMock()
        provider_mock.fetch_price = AsyncMock()
        provider_mock.get_name = MagicMock(return_value="yahoo")
        provider_mock.close = AsyncMock()
        return provider_mock

    @pytest.mark.asyncio
    async def test_get_data_returns_cached_data_when_valid(self, service, mock_cache):
        cached_data = MarketData(
            asset="BTC",
            price=45000.0,
            fetched_at=datetime.utcnow(),
            is_stale=False,
        )
        mock_cache.get_cached_market_data.return_value = cached_data
        mock_cache.is_cache_valid.return_value = True

        with patch.object(service, "cache", mock_cache):
            result, meta = await service.get_data("BTC")

            assert result is not None
            assert result.asset == "BTC"
            assert result.price == 45000.0
            assert meta.provider == "cache"

    @pytest.mark.asyncio
    async def test_get_data_fetches_from_coingecko_when_cache_invalid(
        self, service, mock_cache, mock_coingecko
    ):
        mock_cache.get_cached_market_data.return_value = None
        mock_coingecko.fetch_price.return_value = {
            "price": 45000.0,
            "last_updated": 1700000000,
        }
        mock_coingecko.fetch_news.return_value = []

        with patch.object(service, "cache", mock_cache):
            with patch.object(service, "coingecko", mock_coingecko):
                result, meta = await service.get_data("BTC")

                assert result is not None
                assert result.price == 45000.0
                assert meta.provider == "coingecko"
                mock_cache.set_market_data.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_data_falls_back_to_yahoo_when_coingecko_fails(
        self, service, mock_cache, mock_coingecko, mock_yahoo
    ):
        mock_cache.get_cached_market_data.return_value = None
        mock_coingecko.fetch_price.return_value = None
        mock_yahoo.fetch_price.return_value = {
            "price": 44000.0,
            "last_updated": 1700000000,
        }

        with patch.object(service, "cache", mock_cache):
            with patch.object(service, "coingecko", mock_coingecko):
                with patch.object(service, "yahoo", mock_yahoo):
                    result, meta = await service.get_data("BTC")

                    assert result is not None
                    assert result.price == 44000.0
                    assert meta.provider == "yahoo"

    @pytest.mark.asyncio
    async def test_get_data_returns_stale_cache_when_all_providers_fail(
        self, service, mock_cache, mock_coingecko, mock_yahoo
    ):
        stale_cache = MarketData(
            asset="BTC",
            price=43000.0,
            fetched_at=datetime.utcnow() - timedelta(seconds=30),
            is_stale=True,
        )
        mock_cache.get_cached_market_data.return_value = stale_cache
        mock_cache.is_cache_valid.return_value = False
        mock_coingecko.fetch_price.return_value = None
        mock_yahoo.fetch_price.return_value = None

        with patch.object(service, "cache", mock_cache):
            with patch.object(service, "coingecko", mock_coingecko):
                with patch.object(service, "yahoo", mock_yahoo):
                    result, meta = await service.get_data("BTC")

                    assert result is not None
                    assert result.is_stale is True
                    assert meta.stale_warning is True

    @pytest.mark.asyncio
    async def test_get_data_returns_none_when_no_cache_and_all_providers_fail(
        self, service, mock_cache, mock_coingecko, mock_yahoo
    ):
        mock_cache.get_cached_market_data.return_value = None
        mock_coingecko.fetch_price.return_value = None
        mock_yahoo.fetch_price.return_value = None

        with patch.object(service, "cache", mock_cache):
            with patch.object(service, "coingecko", mock_coingecko):
                with patch.object(service, "yahoo", mock_yahoo):
                    result, meta = await service.get_data("BTC")

                    assert result is None

    @pytest.mark.asyncio
    async def test_get_context_returns_formatted_context(
        self, service, mock_cache, mock_coingecko
    ):
        mock_cache.get_cached_market_data.return_value = None
        mock_coingecko.fetch_price.return_value = {
            "price": 45000.0,
            "last_updated": 1700000000,
        }
        mock_coingecko.fetch_news.return_value = [
            NewsItem(title="News 1", source="test", timestamp=datetime.utcnow()),
            NewsItem(title="News 2", source="test", timestamp=datetime.utcnow()),
            NewsItem(title="News 3", source="test", timestamp=datetime.utcnow()),
            NewsItem(title="News 4", source="test", timestamp=datetime.utcnow()),
        ]

        with patch.object(service, "cache", mock_cache):
            with patch.object(service, "coingecko", mock_coingecko):
                context = await service.get_context("BTC")

                assert context is not None
                assert context.asset == "BTC"
                assert context.price == 45000.0
                assert len(context.news_summary) == 3
                assert context.news_summary[0] == "News 1"

    @pytest.mark.asyncio
    async def test_get_context_returns_none_when_no_data(
        self, service, mock_cache, mock_coingecko
    ):
        mock_cache.get_cached_market_data.return_value = None
        mock_coingecko.fetch_price.return_value = None

        with patch.object(service, "cache", mock_cache):
            with patch.object(service, "coingecko", mock_coingecko):
                with patch.object(
                    service.yahoo, "fetch_price", AsyncMock(return_value=None)
                ):
                    context = await service.get_context("BTC")

                    assert context is None
