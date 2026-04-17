from unittest.mock import MagicMock, patch

import pytest

from app.services.market.provider import YFinanceProvider, get_yfinance_symbol, normalize_asset


class TestNormalizeAsset:
    def test_crypto_full_names(self):
        assert normalize_asset("bitcoin") == "BTC"
        assert normalize_asset("ethereum") == "ETH"
        assert normalize_asset("solana") == "SOL"

    def test_crypto_symbols(self):
        assert normalize_asset("btc") == "BTC"
        assert normalize_asset("eth") == "ETH"
        assert normalize_asset("sol") == "SOL"

    def test_case_insensitive(self):
        assert normalize_asset("Bitcoin") == "BTC"
        assert normalize_asset("ETHEREUM") == "ETH"

    def test_unknown_returns_none(self):
        assert normalize_asset("AAPL") is None
        assert normalize_asset("EURUSD") is None


class TestGetYfinanceSymbol:
    def test_crypto(self):
        assert get_yfinance_symbol("BTC") == "BTC-USD"
        assert get_yfinance_symbol("bitcoin") == "BTC-USD"
        assert get_yfinance_symbol("ETH") == "ETH-USD"
        assert get_yfinance_symbol("SOL") == "SOL-USD"

    def test_forex(self):
        assert get_yfinance_symbol("EURUSD") == "EURUSD=X"
        assert get_yfinance_symbol("GBPUSD") == "GBPUSD=X"
        assert get_yfinance_symbol("eurusd") == "EURUSD=X"

    def test_stock(self):
        assert get_yfinance_symbol("AAPL") == "AAPL"
        assert get_yfinance_symbol("tsla") == "TSLA"

    def test_empty_returns_none(self):
        assert get_yfinance_symbol("") is None


class TestYFinanceProvider:
    @pytest.fixture
    def provider(self):
        return YFinanceProvider()

    def test_get_name(self, provider):
        assert provider.get_name() == "yfinance"

    @pytest.mark.asyncio
    async def test_fetch_price_success(self, provider):
        mock_fast_info = MagicMock()
        mock_fast_info.last_price = 74000.0
        mock_ticker = MagicMock()
        mock_ticker.fast_info = mock_fast_info

        with patch("app.services.market.provider.yf.Ticker", return_value=mock_ticker):
            result = await provider.fetch_price("BTC")

        assert result is not None
        assert result["price"] == 74000.0
        assert "last_updated" in result

    @pytest.mark.asyncio
    async def test_fetch_price_forex(self, provider):
        mock_fast_info = MagicMock()
        mock_fast_info.last_price = 1.18
        mock_ticker = MagicMock()
        mock_ticker.fast_info = mock_fast_info

        with patch("app.services.market.provider.yf.Ticker", return_value=mock_ticker) as mock_yf:
            result = await provider.fetch_price("EURUSD")
            mock_yf.assert_called_once_with("EURUSD=X")

        assert result is not None
        assert result["price"] == 1.18

    @pytest.mark.asyncio
    async def test_fetch_price_none_price_returns_none(self, provider):
        mock_fast_info = MagicMock()
        mock_fast_info.last_price = None
        mock_ticker = MagicMock()
        mock_ticker.fast_info = mock_fast_info

        with patch("app.services.market.provider.yf.Ticker", return_value=mock_ticker):
            result = await provider.fetch_price("BTC")

        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_price_unknown_asset_returns_none(self, provider):
        result = await provider.fetch_price("")
        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_price_exception_returns_none(self, provider):
        with patch("app.services.market.provider.yf.Ticker", side_effect=Exception("network error")):
            result = await provider.fetch_price("BTC")

        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_news_returns_empty(self, provider):
        result = await provider.fetch_news("BTC")
        assert result == []

    @pytest.mark.asyncio
    async def test_close_is_noop(self, provider):
        await provider.close()
