import logging
from dataclasses import dataclass
from typing import Any, Callable

from pydantic import SecretStr
from langchain_core.callbacks import AsyncCallbackHandler
from langchain_openai import ChatOpenAI

from app.config import settings
from app.services.debate.exceptions import LLMProviderError

logger = logging.getLogger(__name__)


@dataclass
class ProviderConfig:
    name: str
    factory: Callable[..., Any]


class LLMProviderManager:
    def __init__(
        self,
        providers: list[ProviderConfig],
        enable_failover: bool = True,
    ):
        self._providers = providers
        self._enable_failover = enable_failover

    async def get_llm(
        self,
        streaming: bool = False,
        callbacks: list[AsyncCallbackHandler] | None = None,
    ) -> Any:
        errors: list[Exception] = []
        providers_to_try = (
            self._providers if self._enable_failover else self._providers[:1]
        )

        for provider in providers_to_try:
            try:
                llm = provider.factory(
                    streaming=streaming,
                    callbacks=callbacks,
                )
                logger.info("Using LLM provider: %s", provider.name)
                return llm
            except Exception as exc:
                logger.warning("LLM provider %s failed: %s", provider.name, exc)
                errors.append(exc)

        raise LLMProviderError(f"All LLM providers failed: {[str(e) for e in errors]}")


def _build_openai(
    streaming: bool = False,
    callbacks: list[AsyncCallbackHandler] | None = None,
) -> ChatOpenAI:
    api_key = settings.openai_api_key
    return ChatOpenAI(
        model=settings.debate_llm_model,
        temperature=settings.debate_llm_temperature,
        api_key=SecretStr(api_key) if api_key else None,
        streaming=streaming,
        callbacks=callbacks,
    )


def _build_anthropic(
    streaming: bool = False,
    callbacks: list[AsyncCallbackHandler] | None = None,
) -> Any:
    from langchain_anthropic import ChatAnthropic

    api_key = settings.anthropic_api_key
    return ChatAnthropic(
        model=settings.debate_llm_fallback_model,
        temperature=settings.debate_llm_temperature,
        api_key=SecretStr(api_key) if api_key else None,
        streaming=streaming,
        callbacks=callbacks,
    )


def _build_providers() -> list[ProviderConfig]:
    providers: list[ProviderConfig] = [
        ProviderConfig(name="openai", factory=_build_openai),
    ]
    if settings.anthropic_api_key:
        providers.append(ProviderConfig(name="anthropic", factory=_build_anthropic))
    return providers


_manager: LLMProviderManager | None = None


def _get_manager() -> LLMProviderManager:
    global _manager
    if _manager is None:
        _manager = LLMProviderManager(
            providers=_build_providers(),
            enable_failover=settings.debate_llm_enable_failover,
        )
    return _manager


async def get_llm_with_failover(
    streaming_handler: AsyncCallbackHandler | None = None,
) -> Any:
    manager = _get_manager()
    streaming = streaming_handler is not None
    callbacks = [streaming_handler] if streaming_handler else None
    return await manager.get_llm(streaming=streaming, callbacks=callbacks)
