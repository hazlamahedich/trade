import json
import logging

from langchain_core.prompts import ChatPromptTemplate

from app.services.debate.llm_provider import get_llm_with_failover

logger = logging.getLogger(__name__)

TRADING_ANALYST_PROMPT = """You are a senior trading analyst. Given a debate between a Bull and Bear agent about {asset}, along with technical market data, produce a structured trading analysis.

DEBATE TRANSCRIPT:
{transcript}

TECHNICAL DATA:
{technical_data}

Respond with ONLY valid JSON (no markdown, no code fences) in this exact format:
{{
  "bullScore": <integer 0-100 representing how convincing the bull case is>,
  "bearScore": <integer 0-100 representing how convincing the bear case is>,
  "direction": "<bullish|bearish|neutral>",
  "confidence": <integer 0-100>,
  "summary": "<1-2 sentence summary of the debate outcome>",
  "keySupport": [<price level 1>, <price level 2>],
  "keyResistance": [<price level 1>, <price level 2>],
  "buyZone": {{ "low": <price>, "high": <price>, "rationale": "<why this zone>" }},
  "stopLoss": {{ "price": <price>, "rationale": "<why this level>" }},
  "takeProfit": {{ "price": <price>, "rationale": "<why this level>" }},
  "riskRewardRatio": "<e.g. 1:2.5>",
  "watchlist": ["<key event or level to watch 1>", "<key event or level to watch 2>"],
  "verdict": "<2-3 sentence actionable recommendation>"
}}

IMPORTANT:
- bullScore + bearScore should roughly sum to 100 (they represent probability split)
- All price levels must be realistic based on the technical data
- The verdict should be educational, not prescriptive — use language like "consider" not "should"
- NEVER use forbidden promissory language (guaranteed, risk-free, can't lose, etc.)
"""


async def generate_trading_analysis(
    asset: str,
    messages: list[dict[str, str]],
    technical_data: dict | None = None,
) -> dict:
    llm = await get_llm_with_failover(temperature=0.3)

    transcript_lines = []
    for msg in messages:
        role = msg.get("role", "unknown").upper()
        content = msg.get("content", "")
        transcript_lines.append(f"[{role}]: {content}")
    transcript = "\n".join(transcript_lines)

    tech_str = (
        json.dumps(technical_data, indent=2) if technical_data else "Not available"
    )

    prompt = ChatPromptTemplate.from_template(TRADING_ANALYST_PROMPT)
    chain = prompt | llm

    response = await chain.ainvoke(
        {
            "asset": asset.upper(),
            "transcript": transcript,
            "technical_data": tech_str,
        }
    )

    raw = response.content
    if not isinstance(raw, str):
        raw = str(raw) if raw else "{}"

    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        analysis = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning(f"Trading analyst returned non-JSON: {raw[:200]}")
        analysis = {
            "bullScore": 50,
            "bearScore": 50,
            "direction": "neutral",
            "confidence": 30,
            "summary": "Analysis could not be fully generated.",
            "keySupport": [],
            "keyResistance": [],
            "buyZone": None,
            "stopLoss": None,
            "takeProfit": None,
            "riskRewardRatio": "N/A",
            "watchlist": [],
            "verdict": "Insufficient data for a reliable analysis.",
        }

    return analysis
