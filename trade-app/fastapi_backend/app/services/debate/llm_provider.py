import logging
from typing import Any

from langchain_core.callbacks import AsyncCallbackHandler
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import SecretStr

from app.config import settings
from app.services.debate.exceptions import LLMProviderError

logger = logging.getLogger(__name__)


def _build_gemini(
    streaming: bool = False,
    callbacks: list[AsyncCallbackHandler] | None = None,
    model: str | None = None,
    temperature: float | None = None,
) -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=model or settings.debate_llm_model,
        temperature=temperature if temperature is not None else settings.debate_llm_temperature,
        google_api_key=SecretStr(settings.google_api_key) if settings.google_api_key else None,
        streaming=streaming,
        callbacks=callbacks,
    )


async def get_llm_with_failover(
    streaming_handler: AsyncCallbackHandler | None = None,
    model: str | None = None,
    temperature: float | None = None,
) -> Any:
    if not settings.google_api_key:
        raise LLMProviderError("google_api_key is required. Set GOOGLE_API_KEY environment variable.")
    try:
        streaming = streaming_handler is not None
        callbacks = [streaming_handler] if streaming_handler else None
        llm = _build_gemini(
            streaming=streaming,
            callbacks=callbacks,
            model=model,
            temperature=temperature,
        )
        logger.info("Using LLM provider: gemini (model=%s)", model or settings.debate_llm_model)
        return llm
    except Exception as exc:
        raise LLMProviderError(f"Gemini provider failed: {exc}") from exc
