import json
import logging
import re
from datetime import datetime, timezone

from pydantic import BaseModel

logger = logging.getLogger(__name__)

_DEFAULT_PHRASES = [
    "guaranteed",
    "risk-free",
    "safe bet",
    "sure thing",
    "100%",
    "certainly will",
    "always goes",
    "can't lose",
    "foolproof",
    "no-brainer",
    "bulletproof",
    "surefire",
    "cannot fail",
    "double your",
    "moonshot",
    "to the moon",
]


def _load_forbidden_phrases() -> list[str]:
    try:
        from app.config import settings

        if settings.FORBIDDEN_PHRASES:
            return settings.FORBIDDEN_PHRASES
    except Exception as exc:
        logger.warning(
            f"Failed to load FORBIDDEN_PHRASES from settings, using defaults: {exc}"
        )
    return _DEFAULT_PHRASES


FORBIDDEN_PHRASES = _load_forbidden_phrases()

_COMPILED_PATTERNS = [
    re.compile(re.escape(phrase), re.IGNORECASE) for phrase in FORBIDDEN_PHRASES
]


class SanitizationResult(BaseModel):
    content: str
    is_redacted: bool
    redacted_phrases: list[str]


class SanitizationContext(BaseModel):
    debate_id: str
    agent: str
    turn: int


def sanitize_content(
    content: str, context: SanitizationContext | None = None
) -> SanitizationResult:
    if not isinstance(content, str):
        logger.warning(f"Non-string content received: {type(content)}")
        return SanitizationResult(content="", is_redacted=False, redacted_phrases=[])

    if not content.strip():
        return SanitizationResult(content="", is_redacted=False, redacted_phrases=[])

    matched_phrases: list[str] = []
    for phrase, pattern in zip(FORBIDDEN_PHRASES, _COMPILED_PATTERNS):
        if pattern.search(content):
            matched_phrases.append(phrase)

    sanitized = content
    for phrase, pattern in zip(FORBIDDEN_PHRASES, _COMPILED_PATTERNS):
        if pattern.search(sanitized):
            sanitized = pattern.sub("[REDACTED]", sanitized)

    for phrase in matched_phrases:
        if context is not None:
            logger.warning(
                json.dumps(
                    {
                        "event": "forbidden_phrase_redacted",
                        "source": "safety_net",
                        "debate_id": context.debate_id,
                        "agent": context.agent,
                        "turn": context.turn,
                        "phrase": phrase,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )
            )
        else:
            logger.warning(f"Redacted forbidden phrase: {phrase}")

    return SanitizationResult(
        content=sanitized,
        is_redacted=len(matched_phrases) > 0,
        redacted_phrases=matched_phrases,
    )


def sanitize_response(content: str) -> str:
    return sanitize_content(content).content
