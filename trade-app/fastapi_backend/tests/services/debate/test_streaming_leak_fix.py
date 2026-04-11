import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.debate.streaming import TokenStreamingHandler


def _get_sent_tokens(mock_manager: AsyncMock) -> list[str]:
    tokens = []
    for call in mock_manager.broadcast_to_debate.call_args_list:
        payload = call[0][1]
        if isinstance(payload, dict) and "payload" in payload:
            tokens.append(payload["payload"]["token"])
        else:
            tokens.append(payload.get("token", ""))
    return tokens


class TestTokenStreamingHandlerBuffering:
    @pytest.fixture
    def mock_manager(self):
        manager = AsyncMock()
        manager.broadcast_to_debate = AsyncMock()
        return manager

    @pytest.mark.asyncio
    async def test_no_flush_until_threshold(self, mock_manager):
        handler = TokenStreamingHandler(mock_manager, "deb_123", "bull")
        for char in "short":
            await handler.on_llm_new_token(char)
        mock_manager.broadcast_to_debate.assert_not_called()

    @pytest.mark.asyncio
    async def test_flushes_on_threshold(self, mock_manager):
        handler = TokenStreamingHandler(mock_manager, "deb_123", "bull")
        handler._BUFFER_FLUSH_THRESHOLD = 10
        for char in "abcdefghijk":
            await handler.on_llm_new_token(char)
        assert mock_manager.broadcast_to_debate.call_count >= 1

    @pytest.mark.asyncio
    async def test_llm_end_flushes_all(self, mock_manager):
        handler = TokenStreamingHandler(mock_manager, "deb_123", "bull")
        await handler.on_llm_new_token("hello")
        await handler.on_llm_new_token(" world")
        mock_manager.broadcast_to_debate.assert_not_called()
        await handler.on_llm_end(MagicMock())
        assert mock_manager.broadcast_to_debate.call_count == 1
        tokens = _get_sent_tokens(mock_manager)
        assert tokens[-1] == "hello world"

    @pytest.mark.asyncio
    async def test_empty_buffer_no_broadcast(self, mock_manager):
        handler = TokenStreamingHandler(mock_manager, "deb_123", "bull")
        await handler.on_llm_end(MagicMock())
        mock_manager.broadcast_to_debate.assert_not_called()

    @pytest.mark.asyncio
    async def test_forbidden_phrase_redacted_on_flush(self, mock_manager):
        handler = TokenStreamingHandler(mock_manager, "deb_123", "bull")
        handler._BUFFER_FLUSH_THRESHOLD = 10
        await handler.on_llm_new_token("bitcoin is guaranteed")
        await handler.on_llm_new_token(" to rise " + "x" * 60)
        tokens = _get_sent_tokens(mock_manager)
        sent_text = "".join(tokens)
        assert "guaranteed" not in sent_text
        assert "[REDACTED]" in sent_text

    @pytest.mark.asyncio
    async def test_forbidden_phrase_redacted_on_end(self, mock_manager):
        handler = TokenStreamingHandler(mock_manager, "deb_123", "bull")
        await handler.on_llm_new_token("it's")
        await handler.on_llm_new_token(" risk-free")
        await handler.on_llm_end(MagicMock())
        tokens = _get_sent_tokens(mock_manager)
        sent_text = "".join(tokens)
        assert "risk-free" not in sent_text
        assert "[REDACTED]" in sent_text

    @pytest.mark.asyncio
    async def test_cross_boundary_forbidden_phrase(self, mock_manager):
        handler = TokenStreamingHandler(mock_manager, "deb_123", "bull")
        await handler.on_llm_new_token("it's a sure")
        await handler.on_llm_new_token(" thing indeed")
        await handler.on_llm_end(MagicMock())
        tokens = _get_sent_tokens(mock_manager)
        sent_text = "".join(tokens)
        assert "sure thing" not in sent_text
        assert "[REDACTED]" in sent_text

    @pytest.mark.asyncio
    async def test_multiple_forbidden_phrases(self, mock_manager):
        handler = TokenStreamingHandler(mock_manager, "deb_123", "bull")
        handler._BUFFER_FLUSH_THRESHOLD = 10
        await handler.on_llm_new_token("it's a sure thing and risk-free")
        await handler.on_llm_new_token(" " + "x" * 60)
        tokens = _get_sent_tokens(mock_manager)
        sent_text = "".join(tokens)
        assert "sure thing" not in sent_text
        assert "risk-free" not in sent_text
        assert sent_text.count("[REDACTED]") >= 2

    @pytest.mark.asyncio
    async def test_clean_text_passes_through(self, mock_manager):
        handler = TokenStreamingHandler(mock_manager, "deb_123", "bull")
        await handler.on_llm_new_token("bitcoin is volatile")
        await handler.on_llm_end(MagicMock())
        tokens = _get_sent_tokens(mock_manager)
        sent_text = "".join(tokens)
        assert "[REDACTED]" not in sent_text
        assert "bitcoin is volatile" in sent_text
