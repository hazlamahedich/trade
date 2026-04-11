import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.debate.engine import stream_debate, _pause_events
from app.services.debate.agents.guardian import GuardianAnalysisResult
from tests.services.debate.test_helpers import (
    patched_debate_engine,
    get_action_types,
    schedule_ack,
)


def _safe_analysis(state) -> dict:
    return GuardianAnalysisResult(
        should_interrupt=False,
        risk_level="low",
        reason="All clear",
        safe=True,
        summary_verdict="Wait",
    ).model_dump()


def _critical_analysis(state) -> dict:
    return GuardianAnalysisResult(
        should_interrupt=True,
        risk_level="critical",
        reason="Dangerous advice",
        fallacy_type="dangerous_advice",
        safe=False,
        summary_verdict="High Risk",
    ).model_dump()


def _high_risk_analysis(state) -> dict:
    return GuardianAnalysisResult(
        should_interrupt=True,
        risk_level="high",
        reason="Caution warranted",
        fallacy_type="overconfidence",
        safe=False,
        summary_verdict="Caution",
    ).model_dump()


def _get_statuses(mock_manager) -> list[str]:
    return [
        c[0][1]["payload"]["status"]
        for c in mock_manager.broadcast_to_debate.call_args_list
        if c[0][1]["type"] == "DEBATE/STATUS_UPDATE"
    ]


class TestGuardianFullFlow:
    def setup_method(self):
        _pause_events.clear()

    def teardown_method(self):
        _pause_events.clear()

    @pytest.mark.asyncio
    async def test_safe_flow_no_interrupts(self, mock_manager, mock_stale_guardian):
        analyze_fn = AsyncMock(return_value=_safe_analysis({}))

        with patched_debate_engine(analyze_fn, ack_timeout=2) as mocks:
            mocks["bull"].generate = AsyncMock(
                side_effect=lambda state, **kw: {
                    "messages": state.get("messages", [])
                    + [{"role": "bull", "content": "BTC looks strong"}],
                    "current_turn": state.get("current_turn", 0) + 1,
                    "current_agent": "bear",
                }
            )
            mocks["bear"].generate = AsyncMock(
                side_effect=lambda state, **kw: {
                    "messages": state.get("messages", [])
                    + [{"role": "bear", "content": "But risks remain"}],
                    "current_turn": state.get("current_turn", 0) + 1,
                    "current_agent": "bull",
                }
            )

            result = await stream_debate(
                "deb_safe_flow",
                "BTC",
                {"summary": "Loaded", "price": 50000},
                mock_manager,
                max_turns=2,
                stale_guardian=mock_stale_guardian,
            )

        assert result["status"] == "completed"
        actions = get_action_types(mock_manager)
        assert "DEBATE/GUARDIAN_INTERRUPT" not in actions
        assert "DEBATE/GUARDIAN_VERDICT" in actions
        statuses = _get_statuses(mock_manager)
        assert "completed" in statuses

    @pytest.mark.asyncio
    async def test_critical_interrupt_terminates_debate(
        self, mock_manager, mock_stale_guardian
    ):
        analyze_fn = AsyncMock(return_value=_critical_analysis({}))

        with patched_debate_engine(analyze_fn, ack_timeout=2) as mocks:
            result = await stream_debate(
                "deb_critical",
                "BTC",
                {"summary": "Loaded", "price": 50000},
                mock_manager,
                max_turns=4,
                stale_guardian=mock_stale_guardian,
            )

        actions = get_action_types(mock_manager)
        assert "DEBATE/GUARDIAN_INTERRUPT" in actions

        verdict_calls = [
            c
            for c in mock_manager.broadcast_to_debate.call_args_list
            if c[0][1]["type"] == "DEBATE/GUARDIAN_VERDICT"
        ]
        assert len(verdict_calls) >= 1
        verdict_payload = verdict_calls[-1][0][1]["payload"]
        assert verdict_payload["riskLevel"] == "critical"

    @pytest.mark.asyncio
    async def test_high_risk_interrupt_does_not_terminate(
        self, mock_manager, mock_stale_guardian
    ):
        analyze_fn = AsyncMock(return_value=_high_risk_analysis({}))

        with patched_debate_engine(analyze_fn, ack_timeout=2) as mocks:
            mocks["bull"].generate = AsyncMock(
                side_effect=lambda state, **kw: {
                    "messages": state.get("messages", [])
                    + [{"role": "bull", "content": "Bull"}],
                    "current_turn": state.get("current_turn", 0) + 1,
                    "current_agent": "bear",
                }
            )
            mocks["bear"].generate = AsyncMock(
                side_effect=lambda state, **kw: {
                    "messages": state.get("messages", [])
                    + [{"role": "bear", "content": "Bear"}],
                    "current_turn": state.get("current_turn", 0) + 1,
                    "current_agent": "bull",
                }
            )

            await schedule_ack("deb_high_risk", delay=0.1)

            result = await stream_debate(
                "deb_high_risk",
                "BTC",
                {"summary": "Loaded", "price": 50000},
                mock_manager,
                max_turns=4,
                stale_guardian=mock_stale_guardian,
            )

        actions = get_action_types(mock_manager)
        assert "DEBATE/GUARDIAN_INTERRUPT" in actions
        statuses = _get_statuses(mock_manager)
        assert "completed" in statuses

    @pytest.mark.asyncio
    async def test_guardian_disabled_skips_all_checks(
        self, mock_manager, mock_stale_guardian
    ):
        analyze_fn = AsyncMock(return_value=_safe_analysis({}))

        with patched_debate_engine(analyze_fn, ack_timeout=2) as mocks:
            with patch("app.config.settings") as mock_settings:
                mock_settings.guardian_enabled = False
                mock_settings.DATABASE_URL = "postgresql://test"
                mock_settings.EXPIRE_ON_COMMIT = False
                mock_settings.OPENAPI_URL = "/openapi.json"
                mock_settings.REDIS_URL = "redis://localhost:6379/0"
                mock_settings.ACCESS_SECRET_KEY = "test"
                mock_settings.RESET_PASSWORD_SECRET_KEY = "test"
                mock_settings.VERIFICATION_SECRET_KEY = "test"
                mock_settings.CORS_ORIGINS = set()
                mock_settings.openai_api_key = "test"
                mock_settings.ENVIRONMENT = "test"

                await stream_debate(
                    "deb_disabled",
                    "BTC",
                    {"summary": "Loaded", "price": 50000},
                    mock_manager,
                    max_turns=2,
                    stale_guardian=mock_stale_guardian,
                )
                actions = get_action_types(mock_manager)
                assert "DEBATE/GUARDIAN_INTERRUPT" not in actions
                assert "DEBATE/GUARDIAN_VERDICT" not in actions
                analyze_fn.assert_not_called()

    @pytest.mark.asyncio
    async def test_interrupt_then_resume_completes(
        self, mock_manager, mock_stale_guardian
    ):
        call_count = 0

        async def alternating_analysis(state) -> dict:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return _critical_analysis(state)
            return _safe_analysis(state)

        analyze_fn = AsyncMock(side_effect=alternating_analysis)

        with patched_debate_engine(analyze_fn, ack_timeout=2) as mocks:
            mocks["bull"].generate = AsyncMock(
                side_effect=lambda state, **kw: {
                    "messages": state.get("messages", [])
                    + [{"role": "bull", "content": "Bull"}],
                    "current_turn": state.get("current_turn", 0) + 1,
                    "current_agent": "bear",
                }
            )
            mocks["bear"].generate = AsyncMock(
                side_effect=lambda state, **kw: {
                    "messages": state.get("messages", [])
                    + [{"role": "bear", "content": "Bear"}],
                    "current_turn": state.get("current_turn", 0) + 1,
                    "current_agent": "bull",
                }
            )

            await schedule_ack("deb_ack_flow", delay=0.1)

            result = await stream_debate(
                "deb_ack_flow",
                "BTC",
                {"summary": "Loaded", "price": 50000},
                mock_manager,
                max_turns=4,
                stale_guardian=mock_stale_guardian,
            )

        actions = get_action_types(mock_manager)
        assert "DEBATE/GUARDIAN_INTERRUPT" in actions
        statuses = _get_statuses(mock_manager)
        assert "completed" in statuses

    @pytest.mark.asyncio
    async def test_guardian_verdict_contains_interrupt_count(
        self, mock_manager, mock_stale_guardian
    ):
        turns_with_interrupt = {1: True, 2: False}

        async def selective_analysis(state) -> dict:
            turn = state.get("current_turn", 0)
            if turn in turns_with_interrupt and turns_with_interrupt[turn]:
                return _critical_analysis(state)
            return _safe_analysis(state)

        analyze_fn = AsyncMock(side_effect=selective_analysis)

        with patched_debate_engine(analyze_fn, ack_timeout=2) as mocks:
            mocks["bull"].generate = AsyncMock(
                side_effect=lambda state, **kw: {
                    "messages": state.get("messages", [])
                    + [{"role": "bull", "content": "Bull"}],
                    "current_turn": state.get("current_turn", 0) + 1,
                    "current_agent": "bear",
                }
            )
            mocks["bear"].generate = AsyncMock(
                side_effect=lambda state, **kw: {
                    "messages": state.get("messages", [])
                    + [{"role": "bear", "content": "Bear"}],
                    "current_turn": state.get("current_turn", 0) + 1,
                    "current_agent": "bull",
                }
            )

            for _ in range(3):
                await schedule_ack("deb_count", delay=0.05)

            await stream_debate(
                "deb_count",
                "BTC",
                {"summary": "Loaded", "price": 50000},
                mock_manager,
                max_turns=4,
                stale_guardian=mock_stale_guardian,
            )

        verdict_calls = [
            c
            for c in mock_manager.broadcast_to_debate.call_args_list
            if c[0][1]["type"] == "DEBATE/GUARDIAN_VERDICT"
        ]
        assert len(verdict_calls) >= 1
        last_verdict = verdict_calls[-1][0][1]["payload"]
        assert last_verdict["totalInterrupts"] >= 1
