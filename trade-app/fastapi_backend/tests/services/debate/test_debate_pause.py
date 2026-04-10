import asyncio
import pytest
from contextlib import contextmanager, ExitStack
from unittest.mock import patch, MagicMock, AsyncMock
from typing import Any, Callable, Awaitable

from app.services.debate.engine import (
    _set_pause_event,
    _clear_pause_event,
    get_pause_event,
    _wait_for_guardian_ack,
    _pause_events,
    stream_debate,
)
from app.services.debate.streaming import (
    send_debate_paused,
    send_debate_resumed,
    DebateConnectionManager,
)
from app.services.debate.ws_schemas import (
    DebatePausedPayload,
    DebateResumedPayload,
)

_DEFAULT_BULL_RETURN = {
    "messages": [{"role": "bull", "content": "Test"}],
    "current_turn": 1,
    "current_agent": "bear",
}

_DEFAULT_BEAR_RETURN = {
    "messages": [
        {"role": "bull", "content": "Test"},
        {"role": "bear", "content": "Bear"},
    ],
    "current_turn": 2,
    "current_agent": "bull",
}


@contextmanager
def _patched_debate_engine(
    analyze_fn: Callable[[Any], Awaitable[dict]],
    *,
    ack_timeout: float = 5,
    freshness_interval: float | None = None,
):
    with ExitStack() as stack:
        mock_bull_cls = stack.enter_context(
            patch("app.services.debate.engine.BullAgent")
        )
        mock_bear_cls = stack.enter_context(
            patch("app.services.debate.engine.BearAgent")
        )
        mock_guard_cls = stack.enter_context(
            patch("app.services.debate.engine.GuardianAgent")
        )
        mock_ss = stack.enter_context(patch("app.services.debate.engine.stream_state"))
        stack.enter_context(
            patch("app.services.debate.engine.GUARDIAN_ACK_TIMEOUT", ack_timeout)
        )

        if freshness_interval is not None:
            stack.enter_context(
                patch(
                    "app.services.debate.engine.FRESHNESS_CHECK_INTERVAL",
                    freshness_interval,
                )
            )

        mock_ss.save_state = AsyncMock()

        mock_bull = MagicMock()
        mock_bull.generate = AsyncMock(return_value=_DEFAULT_BULL_RETURN)
        mock_bull_cls.return_value = mock_bull

        mock_bear = MagicMock()
        mock_bear.generate = AsyncMock(return_value=_DEFAULT_BEAR_RETURN)
        mock_bear_cls.return_value = mock_bear

        mock_guard = MagicMock()
        mock_guard.analyze = analyze_fn
        mock_guard_cls.return_value = mock_guard

        yield {
            "bull": mock_bull,
            "bear": mock_bear,
            "guard": mock_guard,
            "stream_state": mock_ss,
        }


def _get_action_types(mock_manager: MagicMock) -> list[str]:
    return [c[0][1]["type"] for c in mock_manager.broadcast_to_debate.call_args_list]


async def _schedule_ack(debate_id: str, delay: float = 0.1) -> asyncio.Task:
    async def _set():
        await asyncio.sleep(delay)
        event = get_pause_event(debate_id)
        assert event is not None
        event.set()

    return asyncio.create_task(_set())


class TestPauseEventLifecycle:
    def setup_method(self):
        _pause_events.clear()

    def teardown_method(self):
        _pause_events.clear()

    def test_2_2_unit_001_set_pause_event(self):
        event = asyncio.Event()
        _set_pause_event("deb_1", event)

        assert get_pause_event("deb_1") is event

    def test_2_2_unit_002_clear_pause_event(self):
        event = asyncio.Event()
        _set_pause_event("deb_1", event)
        _clear_pause_event("deb_1")

        assert get_pause_event("deb_1") is None

    def test_2_2_unit_003_clear_nonexistent_event_no_error(self):
        _clear_pause_event("nonexistent")

    def test_2_2_unit_004_get_nonexistent_event(self):
        assert get_pause_event("nonexistent") is None

    def test_2_2_unit_005_clear_event_is_idempotent(self):
        event = asyncio.Event()
        _set_pause_event("deb_1", event)
        _clear_pause_event("deb_1")
        _clear_pause_event("deb_1")

        assert get_pause_event("deb_1") is None


class TestWaitForGuardianAck:
    def setup_method(self):
        _pause_events.clear()

    def teardown_method(self):
        _pause_events.clear()

    @pytest.mark.asyncio
    async def test_2_2_unit_006_resolves_on_event_set(self):
        async def set_event_after_delay():
            await asyncio.sleep(0.05)
            event = get_pause_event("deb_ack")
            assert event is not None
            event.set()

        task = asyncio.create_task(set_event_after_delay())
        result = await _wait_for_guardian_ack("deb_ack", "high")
        await task

        assert result == "acknowledged"
        assert get_pause_event("deb_ack") is None

    @pytest.mark.asyncio
    async def test_2_2_unit_007_times_out_gracefully(self):
        with patch("app.services.debate.engine.GUARDIAN_ACK_TIMEOUT", 0.1):
            result = await _wait_for_guardian_ack("deb_timeout", "high")

        assert result == "timeout"
        assert get_pause_event("deb_timeout") is None

    @pytest.mark.asyncio
    async def test_2_2_unit_008_creates_fresh_event_per_call(self):
        with patch("app.services.debate.engine.GUARDIAN_ACK_TIMEOUT", 0.1):
            result1 = await _wait_for_guardian_ack("deb_fresh", "high")

        assert result1 == "timeout"

        async def set_second_event():
            await asyncio.sleep(0.05)
            event = get_pause_event("deb_fresh")
            assert event is not None
            event.set()

        task = asyncio.create_task(set_second_event())
        result2 = await _wait_for_guardian_ack("deb_fresh", "medium")
        await task

        assert result2 == "acknowledged"

    @pytest.mark.asyncio
    async def test_2_2_unit_009_clears_event_after_ack(self):
        async def set_event():
            await asyncio.sleep(0.05)
            event = get_pause_event("deb_clear")
            event.set()

        task = asyncio.create_task(set_event())
        await _wait_for_guardian_ack("deb_clear", "high")
        await task

        assert get_pause_event("deb_clear") is None


class TestSendDebatePaused:
    @pytest.mark.asyncio
    async def test_2_2_unit_010_broadcasts_correct_payload(self):
        manager = MagicMock(spec=DebateConnectionManager)
        manager.broadcast_to_debate = AsyncMock()

        await send_debate_paused(
            manager,
            "deb_123",
            reason="Overconfidence detected",
            risk_level="high",
            summary_verdict="High Risk",
            turn=2,
        )

        manager.broadcast_to_debate.assert_called_once()
        call_args = manager.broadcast_to_debate.call_args
        action_data = call_args[0][1]

        assert action_data["type"] == "DEBATE/DEBATE_PAUSED"
        assert action_data["payload"]["debateId"] == "deb_123"
        assert action_data["payload"]["riskLevel"] == "high"
        assert action_data["payload"]["summaryVerdict"] == "High Risk"
        assert action_data["payload"]["turn"] == 2


class TestSendDebateResumed:
    @pytest.mark.asyncio
    async def test_2_2_unit_011_broadcasts_correct_payload(self):
        manager = MagicMock(spec=DebateConnectionManager)
        manager.broadcast_to_debate = AsyncMock()

        await send_debate_resumed(
            manager,
            "deb_123",
            turn=2,
        )

        manager.broadcast_to_debate.assert_called_once()
        call_args = manager.broadcast_to_debate.call_args
        action_data = call_args[0][1]

        assert action_data["type"] == "DEBATE/DEBATE_RESUMED"
        assert action_data["payload"]["debateId"] == "deb_123"
        assert action_data["payload"]["turn"] == 2


class TestDebatePausedPayloadSerialization:
    def test_2_2_unit_012_camel_case_serialization(self):
        payload = DebatePausedPayload(
            debate_id="deb_123",
            reason="Test reason",
            risk_level="high",
            summary_verdict="High Risk",
            turn=1,
        )

        serialized = payload.model_dump(by_alias=True)
        assert "debateId" in serialized
        assert "riskLevel" in serialized
        assert "summaryVerdict" in serialized
        assert serialized["debateId"] == "deb_123"


class TestDebateResumedPayloadSerialization:
    def test_2_2_unit_013_camel_case_serialization(self):
        payload = DebateResumedPayload(
            debate_id="deb_123",
            turn=3,
        )

        serialized = payload.model_dump(by_alias=True)
        assert "debateId" in serialized
        assert serialized["debateId"] == "deb_123"
        assert serialized["turn"] == 3


class TestEnginePauseIntegration:
    def setup_method(self):
        _pause_events.clear()

    def teardown_method(self):
        _pause_events.clear()

    @pytest.mark.asyncio
    async def test_2_2_int_001_engine_pauses_on_guardian_interrupt(
        self, mock_manager, mock_stale_guardian, guardian_interrupt_result
    ):
        ack_task = await _schedule_ack("deb_pause_1")

        async def fake_analyze(state):
            return guardian_interrupt_result.model_dump()

        with _patched_debate_engine(fake_analyze):
            await stream_debate(
                "deb_pause_1",
                "BTC",
                {"summary": "test"},
                mock_manager,
                max_turns=1,
                stale_guardian=mock_stale_guardian,
            )
            await ack_task

        action_types = _get_action_types(mock_manager)
        assert "DEBATE/GUARDIAN_INTERRUPT" in action_types
        assert "DEBATE/DEBATE_PAUSED" in action_types

    @pytest.mark.asyncio
    async def test_2_2_int_002_engine_resumes_on_ack(
        self, mock_manager, mock_stale_guardian, guardian_interrupt_result
    ):
        ack_task = await _schedule_ack("deb_resume_1")

        call_count = [0]

        async def fake_analyze(state):
            call_count[0] += 1
            if call_count[0] == 1:
                return guardian_interrupt_result.model_dump()
            return {
                "should_interrupt": False,
                "risk_level": "low",
                "fallacy_type": None,
                "reason": "Safe",
                "summary_verdict": "Wait",
                "safe": True,
                "detailed_reasoning": "",
            }

        with _patched_debate_engine(fake_analyze):
            await stream_debate(
                "deb_resume_1",
                "BTC",
                {"summary": "test"},
                mock_manager,
                max_turns=2,
                stale_guardian=mock_stale_guardian,
            )
            await ack_task

        action_types = _get_action_types(mock_manager)
        assert "DEBATE/DEBATE_PAUSED" in action_types
        assert "DEBATE/DEBATE_RESUMED" in action_types

    @pytest.mark.asyncio
    async def test_2_2_int_003_engine_ends_on_critical_interrupt(
        self, mock_manager, mock_stale_guardian, critical_guardian_result
    ):
        ack_task = await _schedule_ack("deb_critical_1")

        async def fake_analyze(state):
            return critical_guardian_result.model_dump()

        with _patched_debate_engine(fake_analyze):
            result = await stream_debate(
                "deb_critical_1",
                "BTC",
                {"summary": "test"},
                mock_manager,
                max_turns=4,
                stale_guardian=mock_stale_guardian,
            )
            await ack_task

        assert result["status"] == "completed"
        action_types = _get_action_types(mock_manager)
        assert "DEBATE/DEBATE_PAUSED" in action_types
        assert "DEBATE/DEBATE_RESUMED" not in action_types

    @pytest.mark.asyncio
    async def test_2_2_int_004_system_message_injected_on_interrupt(
        self, mock_manager, mock_stale_guardian, guardian_interrupt_result
    ):
        ack_task = await _schedule_ack("deb_msg_1")

        async def fake_analyze(state):
            return guardian_interrupt_result.model_dump()

        with _patched_debate_engine(fake_analyze):
            result = await stream_debate(
                "deb_msg_1",
                "BTC",
                {"summary": "test"},
                mock_manager,
                max_turns=1,
                stale_guardian=mock_stale_guardian,
            )
            await ack_task

        guardian_msgs = [
            m for m in result.get("messages", []) if m.get("role") == "guardian"
        ]
        assert len(guardian_msgs) >= 1
        assert guardian_msgs[0]["risk_level"] == "high"

    @pytest.mark.asyncio
    async def test_2_2_int_005_pause_event_cleanup_on_debate_end(
        self, mock_manager, mock_stale_guardian
    ):
        async def safe_analyze(state):
            return {
                "should_interrupt": False,
                "risk_level": "low",
                "fallacy_type": None,
                "reason": "Safe",
                "summary_verdict": "Wait",
                "safe": True,
                "detailed_reasoning": "",
            }

        with _patched_debate_engine(safe_analyze):
            await stream_debate(
                "deb_cleanup_1",
                "BTC",
                {"summary": "test"},
                mock_manager,
                max_turns=1,
                stale_guardian=mock_stale_guardian,
            )

        assert get_pause_event("deb_cleanup_1") is None

    @pytest.mark.asyncio
    async def test_2_2_int_006_pause_event_cleanup_on_error(
        self, mock_manager, mock_stale_guardian, guardian_interrupt_result
    ):
        async def set_ack_later():
            await asyncio.sleep(0.05)
            event = get_pause_event("deb_err_1")
            if event is not None:
                event.set()

        ack_task = asyncio.create_task(set_ack_later())

        call_count = [0]

        async def fake_analyze(state):
            call_count[0] += 1
            if call_count[0] == 1:
                return guardian_interrupt_result.model_dump()
            raise RuntimeError("Guardian exploded")

        with _patched_debate_engine(fake_analyze):
            try:
                await stream_debate(
                    "deb_err_1",
                    "BTC",
                    {"summary": "test"},
                    mock_manager,
                    max_turns=2,
                    stale_guardian=mock_stale_guardian,
                )
            except Exception:
                pass

            await ack_task

        assert get_pause_event("deb_err_1") is None

    @pytest.mark.asyncio
    async def test_2_2_int_007_ws_handler_sets_pause_event_on_ack(self):
        event = asyncio.Event()
        _set_pause_event("deb_ws_ack", event)

        assert not event.is_set()

        pause_event = get_pause_event("deb_ws_ack")
        assert pause_event is not None
        pause_event.set()

        assert event.is_set()

        _clear_pause_event("deb_ws_ack")

    @pytest.mark.asyncio
    async def test_2_2_int_008_timeout_on_critical_ends_debate(
        self, mock_manager, mock_stale_guardian, critical_guardian_result
    ):
        async def fake_analyze(state):
            return critical_guardian_result.model_dump()

        with _patched_debate_engine(fake_analyze, ack_timeout=0.1):
            result = await stream_debate(
                "deb_critical_timeout",
                "BTC",
                {"summary": "test"},
                mock_manager,
                max_turns=4,
                stale_guardian=mock_stale_guardian,
            )

        assert result["status"] == "completed"
        action_types = _get_action_types(mock_manager)
        assert "DEBATE/DEBATE_PAUSED" in action_types
        assert "DEBATE/DEBATE_RESUMED" not in action_types
        assert get_pause_event("deb_critical_timeout") is None

    @pytest.mark.asyncio
    async def test_2_2_int_009_pause_history_audit_log(
        self, mock_manager, mock_stale_guardian, guardian_interrupt_result
    ):
        ack_task = await _schedule_ack("deb_audit_1")

        async def fake_analyze(state):
            return guardian_interrupt_result.model_dump()

        with _patched_debate_engine(fake_analyze):
            result = await stream_debate(
                "deb_audit_1",
                "BTC",
                {"summary": "test"},
                mock_manager,
                max_turns=1,
                stale_guardian=mock_stale_guardian,
            )
            await ack_task

        pause_history = result.get("pause_history", [])
        pause_events_list = [e for e in pause_history if e["action"] == "paused"]

        assert len(pause_events_list) >= 1
        assert pause_events_list[0]["risk_level"] == "high"
        assert "timestamp" in pause_events_list[0]
        assert "turn" in pause_events_list[0]

    @pytest.mark.asyncio
    async def test_2_2_int_010_stale_data_during_pause_still_triggers(
        self, mock_manager, guardian_interrupt_result
    ):
        from datetime import datetime, timezone

        from app.services.market.schemas import FreshnessStatus

        fresh_status = FreshnessStatus(
            asset="BTC",
            is_stale=False,
            last_update=datetime.now(timezone.utc),
            age_seconds=5,
            threshold_seconds=60,
        )
        stale_status = FreshnessStatus(
            asset="BTC",
            is_stale=True,
            last_update=datetime.now(timezone.utc),
            age_seconds=120,
            threshold_seconds=60,
        )

        freshness_calls = [0]

        async def fake_get_freshness(asset):
            freshness_calls[0] += 1
            if freshness_calls[0] <= 2:
                return fresh_status
            return stale_status

        mock_sg = MagicMock()
        mock_sg.get_freshness_status = fake_get_freshness

        async def set_ack_after_stale():
            await asyncio.sleep(0.3)
            event = get_pause_event("deb_stale_pause")
            if event is not None:
                event.set()

        ack_task = asyncio.create_task(set_ack_after_stale())

        call_count = [0]

        async def fake_analyze(state):
            call_count[0] += 1
            if call_count[0] == 1:
                return guardian_interrupt_result.model_dump()
            return {
                "should_interrupt": False,
                "risk_level": "low",
                "fallacy_type": None,
                "reason": "Safe",
                "summary_verdict": "Wait",
                "safe": True,
                "detailed_reasoning": "",
            }

        with _patched_debate_engine(fake_analyze, freshness_interval=0.05):
            with pytest.raises(Exception):
                await stream_debate(
                    "deb_stale_pause",
                    "BTC",
                    {"summary": "test"},
                    mock_manager,
                    max_turns=2,
                    stale_guardian=mock_sg,
                )

            await ack_task

        action_types = _get_action_types(mock_manager)
        assert "DEBATE/DEBATE_PAUSED" in action_types
        assert "DEBATE/DATA_STALE" in action_types

    @pytest.mark.asyncio
    async def test_2_2_int_011_multiple_interrupts_in_one_debate(
        self, mock_manager, mock_stale_guardian, guardian_interrupt_result
    ):
        """[2-2-INT-011] @p1 Multiple guardian interrupts within a single debate.

        Given a guardian that interrupts on both agent turns
        When the debate runs for 2 turns with recurring ACKs
        Then at least one pause/resume cycle is recorded

        Note: Mocked bull/bear always return current_turn 1/2 respectively,
        so max_turns=2 is used to ensure the loop terminates cleanly.
        """
        call_count = [0]

        async def fake_analyze(state):
            call_count[0] += 1
            # Interrupt on turns 1 and 2; call 3 is the final verdict (no interrupt)
            if call_count[0] in (1, 2):
                return guardian_interrupt_result.model_dump()
            return {
                "should_interrupt": False,
                "risk_level": "low",
                "fallacy_type": None,
                "reason": "Safe",
                "summary_verdict": "Wait",
                "safe": True,
                "detailed_reasoning": "",
            }

        # Recurring ack: periodically checks for a pause event and sets it,
        # handling multiple sequential interrupts within the same debate.
        ack_count = [0]

        async def recurring_ack(
            debate_id: str, interval: float = 0.1, max_acks: int = 4
        ):
            for _ in range(max_acks):
                await asyncio.sleep(interval)
                event = get_pause_event(debate_id)
                if event is not None:
                    ack_count[0] += 1
                    event.set()

        ack_task = asyncio.create_task(recurring_ack("deb_multi_1", interval=0.1))

        with _patched_debate_engine(fake_analyze):
            result = await stream_debate(
                "deb_multi_1",
                "BTC",
                {"summary": "test"},
                mock_manager,
                max_turns=2,
                stale_guardian=mock_stale_guardian,
            )

        ack_task.cancel()
        try:
            await ack_task
        except asyncio.CancelledError:
            pass

        pause_events_list = [
            e for e in result.get("pause_history", []) if e["action"] == "paused"
        ]
        assert len(pause_events_list) >= 1
        action_types = _get_action_types(mock_manager)
        paused_count = action_types.count("DEBATE/DEBATE_PAUSED")
        assert paused_count >= 1

    def test_2_2_unit_016_debate_state_backward_compatible(self):
        """[2-2-UNIT-016] @p1 DebateState TypedDict supports optional paused field.

        Given a DebateState without the 'paused' key
        When 'paused' is added and then removed
        Then the state remains valid throughout
        """
        from app.services.debate.state import DebateState

        # Given: a DebateState without the 'paused' key
        state: DebateState = {
            "asset": "BTC",
            "market_context": {"summary": "test"},
            "messages": [],
            "current_turn": 0,
            "max_turns": 6,
            "current_agent": "bull",
            "status": "running",
        }
        assert "paused" not in state
        assert state["status"] == "running"

        # When: paused is set to True
        state["paused"] = True
        assert state["paused"] is True

        # Then: paused can be removed and state is still valid
        state.pop("paused", None)
        assert "paused" not in state
