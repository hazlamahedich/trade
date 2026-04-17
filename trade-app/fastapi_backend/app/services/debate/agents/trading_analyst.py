import json
import logging

from langchain_core.prompts import ChatPromptTemplate

from app.services.debate.llm_provider import get_llm_with_failover

logger = logging.getLogger(__name__)

TRADING_ANALYST_PROMPT = """You are a senior trading analyst and debate judge. Given a debate between a Bull and Bear agent about {asset}, along with technical market data, produce a structured trading analysis AND declare a clear winner.

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
  "winner": "<bull|bear|tie>",
  "winnerRationale": "<2-3 sentences explaining WHICH specific arguments from the winning side were most convincing and WHY they prevailed over the opposing arguments. Reference specific claims, data points, or technical indicators that were cited.>",
  "summary": "<1-2 sentence summary declaring the debate winner and the key reason>",
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
- You MUST pick a clear winner in the "winner" field unless both sides are equally convincing (then use "tie")
- The winnerRationale must reference SPECIFIC arguments from the transcript — which claims were backed by data, which reasoning was more sound
- The summary must explicitly state who won and why (e.g., "Bull wins because X, Y, Z arguments were data-backed while Bear's concerns about A were speculative")
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
            "winner": "tie",
            "winnerRationale": "Analysis could not be fully generated.",
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
