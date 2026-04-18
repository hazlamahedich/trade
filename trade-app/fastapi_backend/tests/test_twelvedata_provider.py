import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.market.twelvedata_provider import (
    TwelveDataForexProvider,
    is_forex_asset,
    normalize_forex_symbol,
)


class TestForexDetection:
    def test_is_forex_eurusd(self):
        assert is_forex_asset("EURUSD") is True

    def test_is_forex_gbpusd(self):
        assert is_forex_asset("GBPUSD") is True

    def test_is_forex_case_insensitive(self):
        assert is_forex_asset("eurusd") is True

    def test_is_not_forex_stock(self):
        assert is_forex_asset("AAPL") is False

    def test_is_not_forex_crypto(self):
        assert is_forex_asset("BTC") is False

    def test_is_not_forex_bitcoin(self):
        assert is_forex_asset("bitcoin") is False

    def test_is_forex_six_char_alpha(self):
        assert is_forex_asset("USDSGD") is True

    def test_is_not_forex_short(self):
        assert is_forex_asset("EUR") is False

    def test_is_not_forex_numeric(self):
        assert is_forex_asset("EUR123") is False


class TestNormalizeForexSymbol:
    def test_eurusd(self):
        assert normalize_forex_symbol("EURUSD") == "EUR/USD"

    def test_gbpusd(self):
        assert normalize_forex_symbol("GBPUSD") == "GBP/USD"

    def test_unknown_pair(self):
        assert normalize_forex_symbol("USDSGD") == "USD/SGD"

    def test_stock_returns_none(self):
        assert normalize_forex_symbol("AAPL") is None

    def test_short_returns_none(self):
        assert normalize_forex_symbol("EUR") is None


class TestTwelveDataForexProvider:
    @pytest.fixture
    def provider(self):
        return TwelveDataForexProvider(
            api_key="test_key", base_url="https://api.test.com"
        )

    def test_get_name(self, provider):
        assert provider.get_name() == "twelvedata"

    @pytest.mark.asyncio
    async def test_fetch_price_success(self, provider):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {"price": "1.0856"}

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.is_closed = False
        provider._client = mock_client

        result = await provider.fetch_price("EURUSD")
        assert result is not None
        assert result["price"] == 1.0856
        assert "last_updated" in result

    @pytest.mark.asyncio
    async def test_fetch_price_no_data(self, provider):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {"price": None}

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.is_closed = False
        provider._client = mock_client

        result = await provider.fetch_price("EURUSD")
        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_price_non_forex(self, provider):
        result = await provider.fetch_price("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_price_api_error(self, provider):
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=Exception("API error"))
        mock_client.is_closed = False
        provider._client = mock_client

        result = await provider.fetch_price("EURUSD")
        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_news_returns_empty(self, provider):
        result = await provider.fetch_news("EURUSD")
        assert result == []

    @pytest.mark.asyncio
    async def test_fetch_ohlcv_success(self, provider):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "values": [
                {
                    "datetime": "2024-01-15",
                    "open": "1.0850",
                    "high": "1.0870",
                    "low": "1.0840",
                    "close": "1.0860",
                },
                {
                    "datetime": "2024-01-14",
                    "open": "1.0840",
                    "high": "1.0860",
                    "low": "1.0830",
                    "close": "1.0850",
                },
            ]
        }

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client.is_closed = False
        provider._client = mock_client

        result = await provider.fetch_ohlcv("EURUSD")
        assert len(result) == 2
        assert result[0]["open"] == 1.0840
        assert result[0]["close"] == 1.0850
        assert result[0]["volume"] is None

    @pytest.mark.asyncio
    async def test_fetch_ohlcv_non_forex(self, provider):
        result = await provider.fetch_ohlcv("AAPL")
        assert result == []

    @pytest.mark.asyncio
    async def test_fetch_forex_meta(self, provider):
        result = await provider.fetch_forex_meta("EURUSD")
        assert result is not None
        assert result["pair"] == "EUR/USD"
        assert result["base_currency"] == "EUR"
        assert result["quote_currency"] == "USD"
        assert result["pip_value"] == 0.0001
        assert result["lot_size"] == 100000

    @pytest.mark.asyncio
    async def test_fetch_forex_meta_jpy(self, provider):
        result = await provider.fetch_forex_meta("USDJPY")
        assert result is not None
        assert result["pair"] == "USD/JPY"
        assert result["pip_value"] == 0.01

    @pytest.mark.asyncio
    async def test_fetch_forex_meta_non_forex(self, provider):
        result = await provider.fetch_forex_meta("AAPL")
        assert result is None

    @pytest.mark.asyncio
    async def test_close(self, provider):
        mock_client = AsyncMock()
        mock_client.is_closed = False
        mock_client.aclose = AsyncMock()
        provider._client = mock_client

        await provider.close()
        mock_client.aclose.assert_called_once()
        assert provider._client is None

    @pytest.mark.asyncio
    async def test_close_no_client(self, provider):
        provider._client = None
        await provider.close()


class TestEnrichedSchemas:
    def test_market_context_with_no_enrichment(self):
        from app.services.market.schemas import MarketContext

        ctx = MarketContext(
            asset="AAPL",
            price=150.0,
            news_summary=["Test"],
            is_stale=False,
        )
        assert ctx.ohlcv is None
        assert ctx.technicals is None
        assert ctx.forex_meta is None

    def test_market_context_with_forex_enrichment(self):
        from app.services.market.schemas import (
            MarketContext,
            OHLCVCandle,
            TechnicalIndicators,
            ForexMeta,
        )

        ctx = MarketContext(
            asset="EURUSD",
            price=1.0856,
            news_summary=["RSI(14): 65.2"],
            is_stale=False,
            ohlcv=[
                OHLCVCandle(
                    time=1705276800, open=1.085, high=1.087, low=1.084, close=1.086
                )
            ],
            technicals=TechnicalIndicators(
                rsi_14=65.2,
                sma_20=1.084,
                sma_50=1.082,
            ),
            forex_meta=ForexMeta(
                pair="EUR/USD",
                base_currency="EUR",
                quote_currency="USD",
                pip_value=0.0001,
                lot_size=100000,
            ),
        )
        assert ctx.ohlcv is not None
        assert len(ctx.ohlcv) == 1
        assert ctx.technicals.rsi_14 == 65.2
        assert ctx.forex_meta.pair == "EUR/USD"

    def test_market_context_serialization(self):
        from app.services.market.schemas import (
            MarketContext,
            TechnicalIndicators,
            ForexMeta,
        )

        ctx = MarketContext(
            asset="EURUSD",
            price=1.0856,
            news_summary=[],
            is_stale=False,
            technicals=TechnicalIndicators(rsi_14=65.2),
            forex_meta=ForexMeta(
                pair="EUR/USD",
                base_currency="EUR",
                quote_currency="USD",
            ),
        )
        dumped = ctx.model_dump()
        assert dumped["ohlcv"] is None
        assert dumped["technicals"]["rsi_14"] == 65.2
        assert dumped["forex_meta"]["pair"] == "EUR/USD"

    def test_market_context_backward_compat(self):
        from app.services.market.schemas import MarketContext

        dumped = MarketContext(
            asset="AAPL",
            price=150.0,
            news_summary=["Test"],
            is_stale=False,
        ).model_dump()
        assert "ohlcv" in dumped
        assert "technicals" in dumped
        assert "forex_meta" in dumped
        assert dumped["ohlcv"] is None
