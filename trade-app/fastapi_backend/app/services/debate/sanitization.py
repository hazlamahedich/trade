import logging
import re
from typing import Final

logger = logging.getLogger(__name__)

FORBIDDEN_PHRASES: Final = [
    "guaranteed",
    "risk-free",
    "safe bet",
    "sure thing",
    "100%",
    "certainly will",
    "always goes",
]

_COMPILED_PATTERNS: Final = [
    re.compile(re.escape(phrase), re.IGNORECASE) for phrase in FORBIDDEN_PHRASES
]


def sanitize_response(content: str) -> str:
    """Pre-Guardian filter for forbidden phrases.

    Redacts promissory language to ensure compliance with financial
    disclaimer requirements. Case-insensitive matching.

    Args:
        content: The LLM-generated response text to sanitize.

    Returns:
        Sanitized text with forbidden phrases replaced by [REDACTED].
    """
    if not isinstance(content, str):
        logger.warning(f"Non-string content received: {type(content)}")
        return ""

    for phrase, pattern in zip(FORBIDDEN_PHRASES, _COMPILED_PATTERNS):
        if pattern.search(content):
            content = pattern.sub("[REDACTED]", content)
            logger.warning(f"Redacted forbidden phrase: {phrase}")
    return content
