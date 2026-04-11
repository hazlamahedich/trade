import json
import logging
import re
from datetime import datetime, timezone
from typing import NamedTuple

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

logger.info(
    f"Sanitization module loaded: {len(FORBIDDEN_PHRASES)} forbidden phrases compiled"
)

# TODO: _COMPILED_PATTERNS is compiled once at module load. Runtime config changes
# (e.g., env var hot-reload) will NOT update patterns. If runtime reconfiguration is
# needed, either recompile per-request (negligible cost at 16 phrases) or add a
# reload_forbidden_phrases() function that recompiles the list.
_COMPILED_PATTERNS = [
    re.compile(re.escape(phrase), re.IGNORECASE) for phrase in FORBIDDEN_PHRASES
]


class SanitizationResult(BaseModel):
    content: str
    is_redacted: bool
    redacted_phrases: list[str]
    redaction_ratio: float = 0.0


class SanitizationContext(BaseModel):
    debate_id: str
    agent: str
    turn: int


class ArgumentEntry(NamedTuple):
    """Typed container for turn_arguments entries.

    raw: unsanitized content (internal-only, used for guardian analysis and reasoning quality).
    sanitized: display-safe content (sent via WebSocket, shown in reasoning graph labels).

    IMPORTANT: `raw` must NEVER be exposed via API or logged without sanitization.
    The guardian agent intentionally receives raw content via current_state["messages"]
    so it can evaluate the full unfiltered argument for risk assessment. This is by design.
    """

    raw: str
    sanitized: str


def sanitize_content(
    content: str, context: SanitizationContext | None = None
) -> SanitizationResult:
    if not isinstance(content, str):
        logger.warning(f"Non-string content received: {type(content)}")
        return SanitizationResult(
            content="", is_redacted=False, redacted_phrases=[], redaction_ratio=0.0
        )

    if not content.strip():
        return SanitizationResult(
            content="", is_redacted=False, redacted_phrases=[], redaction_ratio=0.0
        )

    matched_phrases: list[str] = []
    for phrase, pattern in zip(FORBIDDEN_PHRASES, _COMPILED_PATTERNS):
        if pattern.search(content):
            matched_phrases.append(phrase)

    sanitized = content
    for phrase, pattern in zip(FORBIDDEN_PHRASES, _COMPILED_PATTERNS):
        sanitized = pattern.sub("[REDACTED]", sanitized)

    redaction_ratio = 0.0
    if matched_phrases and len(content) > 0:
        redacted_text = content
        for phrase in matched_phrases:
            redacted_text = re.sub(
                re.escape(phrase), "", redacted_text, flags=re.IGNORECASE
            )
        redaction_ratio = round(1 - len(redacted_text) / len(content), 4)

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
        redaction_ratio=redaction_ratio,
    )


def sanitize_response(content: str) -> str:
    return sanitize_content(content).content
