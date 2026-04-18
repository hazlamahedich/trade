import logging
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.callbacks import AsyncCallbackHandler

from app.services.debate.state import DebateState
from app.services.debate.sanitization import FORBIDDEN_PHRASES
from app.services.debate.llm_provider import get_llm_with_failover
from app.services.market.twelvedata_provider import is_forex_asset as _is_forex

logger = logging.getLogger(__name__)

FORBIDDEN_LIST = ", ".join(f'"{p}"' for p in FORBIDDEN_PHRASES)

BULL_SYSTEM_PROMPT = f"""You are the BULL agent in a trading debate. You are aggressive, data-driven, and analytical.
Your role is to present a strong case for BUYING the asset using specific technical and fundamental evidence.

CRITICAL RULES:
1. ALWAYS cite specific numbers from the market data (price levels, RSI, SMA, support/resistance, volume, MACD, Bollinger Bands).
2. When the Bear makes a point, directly refute it with data. Attack weaknesses in their logic.
3. Identify specific price levels where buyers should consider entering.
4. Discuss risk/reward ratio favorably — why the upside potential justifies the risk.
5. NEVER use promissory language. The following phrases are FORBIDDEN and must NEVER appear: {FORBIDDEN_LIST}.
6. Keep arguments to 2-4 sentences. Be punchy and convincing.
7. Reference technical indicators (RSI, SMA, MACD, Bollinger Bands, ATR, support/resistance) when they support your thesis.
8. For forex pairs: reference pip movements, spread conditions, and currency-specific dynamics when forex_meta is present.

FOREX LIVE DATA TOOLS: For forex pairs, you have access to tools that fetch real-time data mid-debate:
- forex_get_price: Get the current price (use if price seems stale)
- forex_get_technicals: Get fresh RSI, MACD, SMA, Bollinger Bands, ATR (use to counter Bear's outdated claims)
- forex_get_ohlcv: Get recent candle data (use to identify patterns)
Use these tools proactively when you need fresh data to strengthen your argument or refute the Bear.

Market Context (includes price, technical indicators, OHLCV data, and forex metadata when available):
{{{{market_context}}}}

Previous Bear Argument (if any) — REFUTE THIS:
{{{{bear_argument}}}}

Generate your bullish argument with specific data points and price levels:"""


class BullAgent:
    def __init__(self, llm=None, streaming_handler: AsyncCallbackHandler | None = None):
        self.streaming_handler = streaming_handler
        self._provided_llm = llm
        self.prompt = ChatPromptTemplate.from_template(BULL_SYSTEM_PROMPT)

    async def _get_llm(self, asset: str = ""):
        if self._provided_llm is not None:
            return self._provided_llm
        llm = await get_llm_with_failover(self.streaming_handler)
        if asset and _is_forex(asset):
            from app.services.debate.tools import get_forex_tools

            tools = get_forex_tools()
            if tools:
                llm = llm.bind_tools(tools)
        return llm

    def _get_last_bear_message(self, state: DebateState) -> str:
        for msg in reversed(state.get("messages", [])):
            if msg.get("role") == "bear":
                return msg.get("content", "")
        return ""

    async def generate(self, state: DebateState) -> dict:
        asset = state.get("asset", "")
        llm = await self._get_llm(asset)
        chain = self.prompt | llm
        response = await chain.ainvoke(
            {
                "market_context": state["market_context"],
                "bear_argument": self._get_last_bear_message(state),
            }
        )
        raw_content = response.content
        if not isinstance(raw_content, str):
            raw_content = str(raw_content) if raw_content else ""
        content = raw_content
        new_message = {"role": "bull", "content": content}
        return {
            "messages": state["messages"] + [new_message],
            "current_turn": state["current_turn"] + 1,
            "current_agent": "bear",
        }
