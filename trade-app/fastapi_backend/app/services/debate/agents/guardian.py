import json
import logging
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.callbacks import AsyncCallbackHandler
from pydantic import BaseModel, Field

from typing import Literal

from app.services.debate.state import DebateState
from app.services.debate.llm_provider import get_llm_with_failover
from app.services.debate.sanitization import sanitize_response

logger = logging.getLogger(__name__)

FALLACY_CATEGORIES = [
    "unsubstantiated_claim",
    "confirmation_bias",
    "overconfidence",
    "cognitive_bias",
    "dangerous_advice",
]

RISK_LEVELS = ["low", "medium", "high", "critical"]


class GuardianAnalysisResult(BaseModel):
    should_interrupt: bool = Field(description="Whether to interrupt the debate")
    risk_level: Literal["low", "medium", "high", "critical"] = Field(
        description="low | medium | high | critical"
    )
    fallacy_type: (
        Literal[
            "unsubstantiated_claim",
            "confirmation_bias",
            "overconfidence",
            "cognitive_bias",
            "dangerous_advice",
        ]
        | None
    ) = Field(default=None, description="Category of detected fallacy")
    reason: str = Field(description="Human-readable explanation of the risk")
    summary_verdict: Literal["Wait", "Caution", "High Risk"] = Field(
        description="Short verdict: Wait | Caution | High Risk"
    )
    safe: bool = Field(description="Whether the argument is safe")
    detailed_reasoning: str = Field(
        default="", description="Extended reasoning for final verdict"
    )


GUARDIAN_SYSTEM_PROMPT = """You are the RISK GUARDIAN agent in a trading debate.
Your role is to protect the user from dangerous financial reasoning.

YOUR #1 PRIORITY: Capital Preservation above all other metrics.
You would rather miss an opportunity than allow a user to take an unwise risk.

You analyze arguments from Bull and Bear agents for:
1. Unsubstantiated claims — assertions without data backing
2. Confirmation bias — cherry-picking favorable data only
3. Overconfidence — treating predictions as certainties
4. Cognitive biases — anchoring, recency, sunk cost fallacies
5. Dangerous advice — implied recommendations to act recklessly

Fallacy Categories: {fallacy_categories}
Risk Levels: low, medium, high, critical

Current Debate State:
Asset: {asset}
Turn: {current_turn}
Market Context: {market_context}

All Arguments So Far:
{all_arguments}

Analyze the MOST RECENT argument for fallacies or dangerous logic.
Respond with your analysis in the required format."""


class GuardianAgent:
    def __init__(self, llm=None, streaming_handler: AsyncCallbackHandler | None = None):
        self.streaming_handler = streaming_handler
        self._provided_llm = llm
        self.prompt = ChatPromptTemplate.from_template(GUARDIAN_SYSTEM_PROMPT)

    async def _get_llm(self):
        if self._provided_llm is not None:
            return self._provided_llm
        from app.config import settings

        return await get_llm_with_failover(
            self.streaming_handler,
            model=settings.guardian_llm_model,
            temperature=settings.guardian_llm_temperature,
        )

    def _format_all_arguments(self, state: DebateState) -> str:
        messages = state.get("messages", [])
        if not messages:
            return "No arguments yet."
        lines = []
        for msg in messages:
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            lines.append(f"[{role.upper()}]: {content}")
        return "\n".join(lines)

    async def analyze(self, state: DebateState) -> dict:
        llm = await self._get_llm()
        structured_llm = llm.with_structured_output(GuardianAnalysisResult)
        chain = self.prompt | structured_llm
        result = await chain.ainvoke(
            {
                "fallacy_categories": ", ".join(FALLACY_CATEGORIES),
                "asset": state.get("asset", "unknown"),
                "current_turn": str(state.get("current_turn", 0)),
                "market_context": json.dumps(
                    state.get("market_context", {}), default=str
                ),
                "all_arguments": self._format_all_arguments(state),
            }
        )

        if isinstance(result, GuardianAnalysisResult):
            analysis = result.model_dump()
        else:
            analysis = {
                "should_interrupt": False,
                "risk_level": "low",
                "fallacy_type": None,
                "reason": "Unable to parse structured output",
                "summary_verdict": "Caution",
                "safe": True,
                "detailed_reasoning": "",
            }

        if analysis.get("reason"):
            analysis["reason"] = sanitize_response(analysis["reason"])
        if analysis.get("detailed_reasoning"):
            analysis["detailed_reasoning"] = sanitize_response(
                analysis["detailed_reasoning"]
            )

        return analysis
