import logging
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.callbacks import AsyncCallbackHandler

from app.services.debate.state import DebateState
from app.services.debate.sanitization import FORBIDDEN_PHRASES
from app.services.debate.llm_provider import get_llm_with_failover

logger = logging.getLogger(__name__)

FORBIDDEN_LIST = ", ".join(f'"{p}"' for p in FORBIDDEN_PHRASES)

BEAR_SYSTEM_PROMPT = f"""You are the BEAR agent in a trading debate. You are sharp, skeptical, and analytical.
Your role is to present a strong case AGAINST buying, exposing risks, overvaluations, and dangerous price levels.

CRITICAL RULES:
1. ALWAYS cite specific numbers from the market data (price levels, RSI, SMA, support/resistance, volume).
2. When the Bull makes a point, directly attack their logic with counter-data. Expose wishful thinking.
3. Identify specific price levels that would invalidate the bull thesis — where stop-losses should be placed.
4. Discuss risk/reward unfavorably — why the downside risk outweighs the potential reward.
5. NEVER use promissory language. The following phrases are FORBIDDEN and must NEVER appear: {FORBIDDEN_LIST}.
6. Keep arguments to 2-4 sentences. Be incisive and hard-hitting.
7. Reference technical indicators (RSI, SMA, support/resistance) when they support your warning.

Market Context (includes price, RSI, SMA, support/resistance levels, volume):
{{market_context}}

Previous Bull Argument — ATTACK THIS:
{{bull_argument}}

Generate your bearish counter-argument with specific data points and risk levels:"""


class BearAgent:
    def __init__(self, llm=None, streaming_handler: AsyncCallbackHandler | None = None):
        self.streaming_handler = streaming_handler
        self._provided_llm = llm
        self.prompt = ChatPromptTemplate.from_template(BEAR_SYSTEM_PROMPT)

    async def _get_llm(self):
        if self._provided_llm is not None:
            return self._provided_llm
        return await get_llm_with_failover(self.streaming_handler)

    def _get_last_bull_message(self, state: DebateState) -> str:
        for msg in reversed(state.get("messages", [])):
            if msg.get("role") == "bull":
                return msg.get("content", "")
        return ""

    async def generate(self, state: DebateState) -> dict:
        llm = await self._get_llm()
        chain = self.prompt | llm
        response = await chain.ainvoke(
            {
                "market_context": state["market_context"],
                "bull_argument": self._get_last_bull_message(state),
            }
        )
        raw_content = response.content
        if not isinstance(raw_content, str):
            raw_content = str(raw_content) if raw_content else ""
        content = raw_content
        new_message = {"role": "bear", "content": content}
        return {
            "messages": state["messages"] + [new_message],
            "current_turn": state["current_turn"] + 1,
            "current_agent": "bull",
        }
