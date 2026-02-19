from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.market.provider import CoinGeckoProvider, YahooFinanceProvider


class TestCoinGeckoProvider:
    @pytest.fixture
    def provider(self):
        return CoinGeckoProvider("redis://localhost:6379/0")

    @pytest.fixture
    def mock_session(self):
        session = AsyncMock()
        return session

    @pytest.mark.asyncio
    async def test_fetch_price_success(self, provider, mock_session):
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(
            return_value={"bitcoin": {"usd": 45000.0, "last_updated_at": 1700000000}}
        )
        mock_session.get = MagicMock(return_value=mock_response)
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=None)

        with patch.object(
            provider, "_get_session", AsyncMock(return_value=mock_session)
        ):
            with patch.object(
                provider.rate_limiter, "acquire", AsyncMock(return_value=True)
            ):
                result = await provider.fetch_price("BTC")

                assert result is not None
                assert result["price"] == 45000.0
                assert result["last_updated"] == 1700000000
        await provider.close()

    @pytest.mark.asyncio
    async def test_fetch_price_rate_limited(self, provider):
        with patch.object(
            provider.rate_limiter, "acquire", AsyncMock(return_value=False)
        ):
            result = await provider.fetch_price("BTC")
            assert result is None
        await provider.close()

    @pytest.mark.asyncio
    async def test_fetch_price_api_error(self, provider, mock_session):
        mock_response = AsyncMock()
        mock_response.status = 500
        mock_session.get = MagicMock(return_value=mock_response)
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=None)

        with patch.object(
            provider, "_get_session", AsyncMock(return_value=mock_session)
        ):
            with patch.object(
                provider.rate_limiter, "acquire", AsyncMock(return_value=True)
            ):
                result = await provider.fetch_price("BTC")
                assert result is None
        await provider.close()

    @pytest.mark.asyncio
    async def test_fetch_news_success(self, provider, mock_session):
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(
            return_value={
                "status_updates": [
                    {
                        "description": "Bitcoin ETF sees record inflows",
                        "permalink": "https://example.com/news/1",
                        "created_at": "2024-01-01T00:00:00Z",
                    }
                ]
            }
        )
        mock_session.get = MagicMock(return_value=mock_response)
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=None)

        with patch.object(
            provider, "_get_session", AsyncMock(return_value=mock_session)
        ):
            with patch.object(
                provider.rate_limiter, "acquire", AsyncMock(return_value=True)
            ):
                result = await provider.fetch_news("BTC")

                assert len(result) == 1
                assert result[0].title == "Bitcoin ETF sees record inflows"
                assert result[0].source == "coingecko"
        await provider.close()

    @pytest.mark.asyncio
    async def test_get_name(self, provider):
        assert provider.get_name() == "coingecko"
        await provider.close()

    @pytest.mark.asyncio
    async def test_fetch_price_timeout(self, provider, mock_session):
        import asyncio

        async def timeout_response(*args, **kwargs):
            raise asyncio.TimeoutError()

        mock_session.get = MagicMock(side_effect=timeout_response)

        with patch.object(
            provider, "_get_session", AsyncMock(return_value=mock_session)
        ):
            with patch.object(
                provider.rate_limiter, "acquire", AsyncMock(return_value=True)
            ):
                result = await provider.fetch_price("BTC")
                assert result is None
        await provider.close()

    @pytest.mark.asyncio
    async def test_fetch_news_timeout(self, provider, mock_session):
        import asyncio

        async def timeout_response(*args, **kwargs):
            raise asyncio.TimeoutError()

        mock_session.get = MagicMock(side_effect=timeout_response)

        with patch.object(
            provider, "_get_session", AsyncMock(return_value=mock_session)
        ):
            with patch.object(
                provider.rate_limiter, "acquire", AsyncMock(return_value=True)
            ):
                result = await provider.fetch_news("BTC")
                assert result == []
        await provider.close()


class TestYahooFinanceProvider:
    @pytest.fixture
    def provider(self):
        return YahooFinanceProvider()

    @pytest.fixture
    def mock_session(self):
        session = AsyncMock()
        return session

    @pytest.mark.asyncio
    async def test_fetch_price_success(self, provider, mock_session):
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(
            return_value={
                "chart": {
                    "result": [
                        {
                            "meta": {
                                "regularMarketPrice": 45000.0,
                            }
                        }
                    ]
                }
            }
        )
        mock_session.get = MagicMock(return_value=mock_response)
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=None)

        with patch.object(
            provider, "_get_session", AsyncMock(return_value=mock_session)
        ):
            result = await provider.fetch_price("BTC")

            assert result is not None
            assert result["price"] == 45000.0
        await provider.close()

    @pytest.mark.asyncio
    async def test_fetch_price_api_error(self, provider, mock_session):
        mock_response = AsyncMock()
        mock_response.status = 500
        mock_session.get = MagicMock(return_value=mock_response)
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=None)

        with patch.object(
            provider, "_get_session", AsyncMock(return_value=mock_session)
        ):
            result = await provider.fetch_price("BTC")
            assert result is None
        await provider.close()

    @pytest.mark.asyncio
    async def test_fetch_news_returns_empty(self, provider):
        result = await provider.fetch_news("BTC")
        assert result == []
        await provider.close()

    @pytest.mark.asyncio
    async def test_get_name(self, provider):
        assert provider.get_name() == "yahoo"
        await provider.close()
