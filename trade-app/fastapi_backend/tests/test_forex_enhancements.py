import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.debate.agents.guardian import GUARDIAN_SYSTEM_PROMPT


class TestGuardianPrompt:
    def test_prompt_contains_forex_guidelines(self):
        assert (
            "forex_meta" in GUARDIAN_SYSTEM_PROMPT.lower()
            or "forex" in GUARDIAN_SYSTEM_PROMPT.lower()
        )

    def test_prompt_contains_technical_validation(self):
        assert "RSI" in GUARDIAN_SYSTEM_PROMPT
        assert "MACD" in GUARDIAN_SYSTEM_PROMPT
        assert "Bollinger Bands" in GUARDIAN_SYSTEM_PROMPT
        assert "ATR" in GUARDIAN_SYSTEM_PROMPT

    def test_prompt_contains_leverage_warning(self):
        assert "leverage" in GUARDIAN_SYSTEM_PROMPT.lower()


class TestTradingAnalystForex:
    @pytest.mark.asyncio
    async def test_generate_trading_analysis_passes_forex_meta(self):
        from app.services.debate.agents.trading_analyst import generate_trading_analysis

        expected = {
            "bullScore": 55,
            "bearScore": 45,
            "direction": "bullish",
            "confidence": 60,
            "winner": "bull",
            "winnerRationale": "Bull cited RSI data.",
            "summary": "Bull wins on RSI.",
            "keySupport": [1.1700],
            "keyResistance": [1.1850],
            "entryZone": {"low": 1.1710, "high": 1.1740, "rationale": "Near support"},
            "stopLoss": {"price": 1.1680, "rationale": "Below support"},
            "takeProfit": {"price": 1.1830, "rationale": "At resistance"},
            "riskRewardRatio": "1:3",
            "watchlist": ["1.1850 resistance"],
            "verdict": "Consider long near support.",
        }

        mock_response = MagicMock()
        mock_response.content = json.dumps(expected)

        mock_chain = MagicMock()
        mock_chain.ainvoke = AsyncMock(return_value=mock_response)

        mock_prompt = MagicMock()
        mock_prompt.__or__ = MagicMock(return_value=mock_chain)

        mock_llm = MagicMock()

        with (
            patch(
                "app.services.debate.agents.trading_analyst.get_llm_with_failover",
                new_callable=AsyncMock,
                return_value=mock_llm,
            ),
            patch(
                "app.services.debate.agents.trading_analyst.ChatPromptTemplate",
            ) as mock_prompt_cls,
        ):
            mock_prompt_cls.from_template.return_value = mock_prompt
            result = await generate_trading_analysis(
                asset="EURUSD",
                messages=[
                    {"role": "bull", "content": "RSI at 45 suggests room to run up"},
                    {"role": "bear", "content": "MACD histogram declining"},
                ],
                technical_data={
                    "rsi14": 45,
                    "macd": {"macd": 0.001, "signal": 0.002, "histogram": -0.001},
                },
                forex_meta={
                    "pair": "EUR/USD",
                    "baseCurrency": "EUR",
                    "quoteCurrency": "USD",
                },
            )

        assert result["bullScore"] == 55
        assert result["bearScore"] == 45
        assert result["direction"] == "bullish"

    @pytest.mark.asyncio
    async def test_generate_trading_analysis_without_forex_meta(self):
        from app.services.debate.agents.trading_analyst import generate_trading_analysis

        expected = {
            "bullScore": 50,
            "bearScore": 50,
            "direction": "neutral",
            "confidence": 40,
            "winner": "tie",
            "winnerRationale": "Balanced arguments.",
            "summary": "No clear winner.",
            "keySupport": [],
            "keyResistance": [],
            "entryZone": None,
            "stopLoss": None,
            "takeProfit": None,
            "riskRewardRatio": "N/A",
            "watchlist": [],
            "verdict": "No edge detected.",
        }

        mock_response = MagicMock()
        mock_response.content = json.dumps(expected)
        mock_chain = MagicMock()
        mock_chain.ainvoke = AsyncMock(return_value=mock_response)
        mock_prompt = MagicMock()
        mock_prompt.__or__ = MagicMock(return_value=mock_chain)
        mock_llm = MagicMock()

        with (
            patch(
                "app.services.debate.agents.trading_analyst.get_llm_with_failover",
                new_callable=AsyncMock,
                return_value=mock_llm,
            ),
            patch(
                "app.services.debate.agents.trading_analyst.ChatPromptTemplate",
            ) as mock_prompt_cls,
        ):
            mock_prompt_cls.from_template.return_value = mock_prompt
            result = await generate_trading_analysis(
                asset="AAPL",
                messages=[{"role": "bull", "content": "Strong earnings"}],
                technical_data={"rsi14": 55},
            )

        assert result["direction"] == "neutral"


class TestForexTools:
    def test_get_forex_tools_returns_tools(self):
        from app.services.debate.tools import get_forex_tools

        with patch("app.services.debate.tools.settings") as mock_settings:
            mock_settings.TWELVEDATA_API_KEY = "test-key"
            tools = get_forex_tools()
            assert len(tools) == 3
            tool_names = [t.name for t in tools]
            assert "_forex_get_price" in tool_names
            assert "_forex_get_technicals" in tool_names
            assert "_forex_get_ohlcv" in tool_names

    def test_get_forex_tools_empty_without_key(self):
        from app.services.debate.tools import get_forex_tools

        with patch("app.services.debate.tools.settings") as mock_settings:
            mock_settings.TWELVEDATA_API_KEY = ""
            tools = get_forex_tools()
            assert len(tools) == 0

    @pytest.mark.asyncio
    async def test_forex_get_price_tool(self):
        from app.services.debate.tools import _forex_get_price

        mock_provider = AsyncMock()
        mock_provider.fetch_price = AsyncMock(
            return_value={"price": 1.1234, "last_updated": 1234.5}
        )

        with patch(
            "app.services.debate.tools._get_provider", return_value=mock_provider
        ):
            result = await _forex_get_price.ainvoke({"asset": "EURUSD"})
            data = json.loads(result)
            assert data["price"] == 1.1234

    @pytest.mark.asyncio
    async def test_forex_get_price_non_forex(self):
        from app.services.debate.tools import _forex_get_price

        with patch("app.services.debate.tools._get_provider", return_value=MagicMock()):
            result = await _forex_get_price.ainvoke({"asset": "AAPL"})
            data = json.loads(result)
            assert "error" in data

    @pytest.mark.asyncio
    async def test_forex_get_technicals_tool(self):
        from app.services.debate.tools import _forex_get_technicals

        mock_provider = AsyncMock()
        mock_provider.fetch_technicals = AsyncMock(
            return_value={
                "rsi_14": 62.3,
                "macd": {"macd": 0.001, "signal": 0.002, "histogram": -0.001},
            }
        )

        with patch(
            "app.services.debate.tools._get_provider", return_value=mock_provider
        ):
            result = await _forex_get_technicals.ainvoke({"asset": "GBPUSD"})
            data = json.loads(result)
            assert data["rsi_14"] == 62.3

    @pytest.mark.asyncio
    async def test_forex_get_ohlcv_tool(self):
        from app.services.debate.tools import _forex_get_ohlcv

        mock_provider = AsyncMock()
        mock_provider.fetch_ohlcv = AsyncMock(
            return_value=[
                {
                    "time": 1700000000,
                    "open": 1.12,
                    "high": 1.13,
                    "low": 1.11,
                    "close": 1.125,
                    "volume": None,
                },
            ]
        )

        with patch(
            "app.services.debate.tools._get_provider", return_value=mock_provider
        ):
            result = await _forex_get_ohlcv.ainvoke(
                {"asset": "USDJPY", "interval": "1day", "outputsize": 10}
            )
            data = json.loads(result)
            assert len(data["candles"]) == 1


class TestWsSchemasForex:
    def test_forex_price_update_in_action_type(self):
        from app.services.debate.ws_schemas import WebSocketActionType
        import typing

        args = typing.get_args(WebSocketActionType)
        assert "DEBATE/FOREX_PRICE_UPDATE" in args

    def test_forex_price_update_payload(self):
        from app.services.debate.ws_schemas import ForexPriceUpdatePayload

        payload = ForexPriceUpdatePayload(
            debate_id="deb_test",
            asset="EURUSD",
            price=1.1234,
            previous_price=1.1200,
            change_pct=0.3036,
            spread=None,
            timestamp="2026-04-18T12:00:00Z",
        )
        dumped = payload.model_dump(by_alias=True)
        assert dumped["debateId"] == "deb_test"
        assert dumped["previousPrice"] == 1.1200
        assert dumped["changePct"] == 0.3036
