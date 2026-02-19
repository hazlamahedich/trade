import logging
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.callbacks import AsyncCallbackHandler
from langchain_openai import ChatOpenAI

from app.services.debate.state import DebateState
from app.services.debate.sanitization import sanitize_response
from app.config import settings

logger = logging.getLogger(__name__)

BULL_SYSTEM_PROMPT = """You are the BULL agent in a trading debate.
Your role is to present OPTIMISTIC arguments for buying the asset.

CRITICAL RULES:
1. ALWAYS cite specific market data points (price, news)
2. Be confident but not promissory - NEVER say "guaranteed" or "risk-free"
3. Reference the Bear's counter-points when responding
4. Keep arguments concise (2-3 sentences max)

Market Context:
{market_context}

Previous Bear Argument (if any):
{bear_argument}

Generate your bullish argument:"""


class BullAgent:
    def __init__(self, llm=None, streaming_handler: AsyncCallbackHandler | None = None):
        self.streaming_handler = streaming_handler
        self.llm = llm or ChatOpenAI(
            model=settings.debate_llm_model,
            temperature=settings.debate_llm_temperature,
            api_key=settings.openai_api_key,
            streaming=streaming_handler is not None,
            callbacks=[streaming_handler] if streaming_handler else None,
        )
        self.prompt = ChatPromptTemplate.from_template(BULL_SYSTEM_PROMPT)

    def _get_last_bear_message(self, state: DebateState) -> str:
        for msg in reversed(state.get("messages", [])):
            if msg.get("role") == "bear":
                return msg.get("content", "")
        return ""

    async def generate(self, state: DebateState) -> dict:
        chain = self.prompt | self.llm
        response = await chain.ainvoke(
            {
                "market_context": state["market_context"],
                "bear_argument": self._get_last_bear_message(state),
            }
        )
        raw_content = response.content
        if not isinstance(raw_content, str):
            raw_content = str(raw_content) if raw_content else ""
        content = sanitize_response(raw_content)
        new_message = {"role": "bull", "content": content}
        return {
            "messages": state["messages"] + [new_message],
            "current_turn": state["current_turn"] + 1,
            "current_agent": "bear",
        }
