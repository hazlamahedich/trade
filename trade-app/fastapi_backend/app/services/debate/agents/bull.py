import logging
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.callbacks import AsyncCallbackHandler

from app.services.debate.state import DebateState
from app.services.debate.sanitization import FORBIDDEN_PHRASES
from app.services.debate.llm_provider import get_llm_with_failover

logger = logging.getLogger(__name__)

FORBIDDEN_LIST = ", ".join(f'"{p}"' for p in FORBIDDEN_PHRASES)

BULL_SYSTEM_PROMPT = f"""You are the BULL agent in a trading debate. You are aggressive, data-driven, and analytical.
Your role is to present a strong case for BUYING the asset using specific technical and fundamental evidence.

CRITICAL RULES:
1. ALWAYS cite specific numbers from the market data (price levels, RSI, SMA, support/resistance, volume).
2. When the Bear makes a point, directly refute it with data. Attack weaknesses in their logic.
3. Identify specific price levels where buyers should consider entering.
4. Discuss risk/reward ratio favorably — why the upside potential justifies the risk.
5. NEVER use promissory language. The following phrases are FORBIDDEN and must NEVER appear: {FORBIDDEN_LIST}.
6. Keep arguments to 2-4 sentences. Be punchy and convincing.
7. Reference technical indicators (RSI, SMA, support/resistance) when they support your thesis.

Market Context (includes price, RSI, SMA, support/resistance levels, volume):
{{market_context}}

Previous Bear Argument (if any) — REFUTE THIS:
{{bear_argument}}

Generate your bullish argument with specific data points and price levels:"""


class BullAgent:
    def __init__(self, llm=None, streaming_handler: AsyncCallbackHandler | None = None):
        self.streaming_handler = streaming_handler
        self._provided_llm = llm
        self.prompt = ChatPromptTemplate.from_template(BULL_SYSTEM_PROMPT)

    async def _get_llm(self):
        if self._provided_llm is not None:
            return self._provided_llm
        return await get_llm_with_failover(self.streaming_handler)

    def _get_last_bear_message(self, state: DebateState) -> str:
        for msg in reversed(state.get("messages", [])):
            if msg.get("role") == "bear":
                return msg.get("content", "")
        return ""

    async def generate(self, state: DebateState) -> dict:
        llm = await self._get_llm()
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
