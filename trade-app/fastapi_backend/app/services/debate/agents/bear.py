import logging
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.callbacks import AsyncCallbackHandler
from langchain_openai import ChatOpenAI

from app.services.debate.state import DebateState
from app.services.debate.sanitization import sanitize_response
from app.config import settings

logger = logging.getLogger(__name__)

BEAR_SYSTEM_PROMPT = """You are the BEAR agent in a trading debate.
Your role is to present SKEPTICAL arguments against buying the asset.

CRITICAL RULES:
1. ALWAYS cite specific market data points (price, news)
2. Focus on risks, uncertainties, and potential downsides
3. Reference the Bull's arguments and provide counter-points
4. Keep arguments concise (2-3 sentences max)

Market Context:
{market_context}

Previous Bull Argument:
{bull_argument}

Generate your bearish counter-argument:"""


class BearAgent:
    def __init__(self, llm=None, streaming_handler: AsyncCallbackHandler | None = None):
        self.streaming_handler = streaming_handler
        self.llm = llm or ChatOpenAI(
            model=settings.debate_llm_model,
            temperature=settings.debate_llm_temperature,
            api_key=settings.openai_api_key,
            streaming=streaming_handler is not None,
            callbacks=[streaming_handler] if streaming_handler else None,
        )
        self.prompt = ChatPromptTemplate.from_template(BEAR_SYSTEM_PROMPT)

    def _get_last_bull_message(self, state: DebateState) -> str:
        for msg in reversed(state.get("messages", [])):
            if msg.get("role") == "bull":
                return msg.get("content", "")
        return ""

    async def generate(self, state: DebateState) -> dict:
        chain = self.prompt | self.llm
        response = await chain.ainvoke(
            {
                "market_context": state["market_context"],
                "bull_argument": self._get_last_bull_message(state),
            }
        )
        raw_content = response.content
        if not isinstance(raw_content, str):
            raw_content = str(raw_content) if raw_content else ""
        content = sanitize_response(raw_content)
        new_message = {"role": "bear", "content": content}
        return {
            "messages": state["messages"] + [new_message],
            "current_turn": state["current_turn"] + 1,
            "current_agent": "bull",
        }
