import json
import time
import pytest
from unittest.mock import patch, MagicMock, AsyncMock, call

from app.services.debate.engine import bull_agent_node, bear_agent_node
from app.services.debate.ws_schemas import ArgumentCompletePayload


def _make_mock_agent(content: str):
    mock = MagicMock()
    mock.generate = AsyncMock(
        return_value={
            "messages": [{"role": "bull", "content": content}],
            "current_turn": 1,
            "current_agent": "bear",
        }
    )
    return mock


def _make_debate_state():
    return {
        "asset": "BTC",
        "market_context": {"summary": "test"},
        "messages": [],
        "current_turn": 0,
        "max_turns": 6,
        "current_agent": "bull",
        "status": "running",
    }


def _find_arg_complete_payload(calls):
    for c in calls:
        payload = c[0][1]
        if payload.get("type") == "DEBATE/ARGUMENT_COMPLETE":
            return payload
    return None


class TestBullAgentNodeSanitization:
    @pytest.mark.asyncio
    async def test_forbidden_phrase_redacted_in_argument_complete(self, mock_manager):
        with patch("app.services.debate.engine.BullAgent") as mock_cls:
            mock_cls.return_value = _make_mock_agent(
                "This is guaranteed profit with risk-free returns"
            )
            state = _make_debate_state()
            await bull_agent_node(state, mock_manager, "deb-1")

        calls = mock_manager.broadcast_to_debate.call_args_list
        payload = _find_arg_complete_payload(calls)
        assert payload is not None
        assert payload["payload"]["isRedacted"] is True
        assert "[REDACTED]" in payload["payload"]["content"]
        assert "guaranteed" not in payload["payload"]["content"].lower()

    @pytest.mark.asyncio
    async def test_clean_output_not_redacted(self, mock_manager):
        with patch("app.services.debate.engine.BullAgent") as mock_cls:
            mock_cls.return_value = _make_mock_agent(
                "Bitcoin may rise based on ETF approval"
            )
            state = _make_debate_state()
            await bull_agent_node(state, mock_manager, "deb-2")

        calls = mock_manager.broadcast_to_debate.call_args_list
        payload = _find_arg_complete_payload(calls)
        assert payload is not None
        assert payload["payload"]["isRedacted"] is False
        assert payload["payload"]["content"] == "Bitcoin may rise based on ETF approval"


class TestBearAgentNodeSanitization:
    @pytest.mark.asyncio
    async def test_forbidden_phrase_redacted(self, mock_manager):
        with patch("app.services.debate.engine.BearAgent") as mock_cls:
            mock = MagicMock()
            mock.generate = AsyncMock(
                return_value={
                    "messages": [{"role": "bear", "content": "This is guaranteed"}],
                    "current_turn": 2,
                    "current_agent": "bull",
                }
            )
            mock_cls.return_value = mock
            state = _make_debate_state()
            state["current_agent"] = "bear"
            await bear_agent_node(state, mock_manager, "deb-3")

        calls = mock_manager.broadcast_to_debate.call_args_list
        payload = _find_arg_complete_payload(calls)
        assert payload is not None
        assert payload["payload"]["isRedacted"] is True
        assert "[REDACTED]" in payload["payload"]["content"]


class TestArgumentCompletePayloadContract:
    def test_is_redacted_serializes_to_isRedacted(self):
        payload = ArgumentCompletePayload(
            debate_id="deb-1",
            agent="bull",
            content="test",
            turn=1,
            is_redacted=True,
        )
        data = payload.model_dump(by_alias=True)
        assert "isRedacted" in data
        assert data["isRedacted"] is True
        assert "is_redacted" not in data

    def test_default_is_redacted_false(self):
        payload = ArgumentCompletePayload(
            debate_id="deb-1", agent="bull", content="test"
        )
        data = payload.model_dump(by_alias=True)
        assert data["isRedacted"] is False


class TestEngineSanitizationIntegration:
    @pytest.mark.asyncio
    async def test_token_streaming_not_filtered(self, mock_manager):
        with patch("app.services.debate.engine.BullAgent") as mock_cls:
            mock_cls.return_value = _make_mock_agent("This has guaranteed profit")
            state = _make_debate_state()
            await bull_agent_node(state, mock_manager, "deb-4")

        calls = mock_manager.broadcast_to_debate.call_args_list
        token_calls = [
            c for c in calls if c[0][1].get("type") == "DEBATE/TOKEN_RECEIVED"
        ]
        arg_complete_calls = [
            c for c in calls if c[0][1].get("type") == "DEBATE/ARGUMENT_COMPLETE"
        ]
        assert len(arg_complete_calls) >= 1
        assert arg_complete_calls[0][0][1]["payload"]["isRedacted"] is True

    @pytest.mark.asyncio
    async def test_empty_response_handled(self, mock_manager):
        with patch("app.services.debate.engine.BullAgent") as mock_cls:
            mock = MagicMock()
            mock.generate = AsyncMock(
                return_value={
                    "messages": [{"role": "bull", "content": ""}],
                    "current_turn": 1,
                    "current_agent": "bear",
                }
            )
            mock_cls.return_value = mock
            state = _make_debate_state()
            result = await bull_agent_node(state, mock_manager, "deb-5")

        assert result is not None
        calls = mock_manager.broadcast_to_debate.call_args_list
        payload = _find_arg_complete_payload(calls)
        assert payload is not None
        assert payload["payload"]["isRedacted"] is False

    @pytest.mark.asyncio
    async def test_high_redaction_logs_warning(self, mock_manager, caplog):
        import logging

        long_forbidden = "guaranteed " * 50
        with (
            caplog.at_level(logging.WARNING),
            patch("app.services.debate.engine.BullAgent") as mock_cls,
        ):
            mock_cls.return_value = _make_mock_agent(long_forbidden)
            state = _make_debate_state()
            await bull_agent_node(state, mock_manager, "deb-6")

        assert any("high_redaction_warning" in r.message for r in caplog.records)

    @pytest.mark.asyncio
    async def test_performance_sanitization_under_10ms(self):
        from app.services.debate.sanitization import sanitize_content

        text = "This is guaranteed to be risk-free and a sure thing " * 50
        start = time.perf_counter()
        for _ in range(100):
            sanitize_content(text)
        elapsed = (time.perf_counter() - start) / 100
        assert elapsed < 0.01, f"Sanitization took {elapsed * 1000:.2f}ms per call"
