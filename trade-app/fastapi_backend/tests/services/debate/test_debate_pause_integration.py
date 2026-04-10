import asyncio
import pytest
from unittest.mock import MagicMock

from app.services.debate.engine import (
    _set_pause_event,
    _clear_pause_event,
    get_pause_event,
    _pause_events,
    stream_debate,
)
from tests.services.debate.test_helpers import (
    patched_debate_engine,
    get_action_types,
    schedule_ack,
)


class TestEnginePauseIntegration:
    def setup_method(self):
        _pause_events.clear()

    def teardown_method(self):
        _pause_events.clear()

    @pytest.mark.asyncio
    async def test_2_2_int_001_engine_pauses_on_guardian_interrupt(
        self, mock_manager, mock_stale_guardian, guardian_interrupt_result
    ):
        """[2-2-INT-001] @p0 Engine pauses when Guardian detects high-risk interrupt.

        Given a guardian that returns an interrupt result
        When stream_debate runs for 1 turn
        Then DEBATE/GUARDIAN_INTERRUPT and DEBATE/DEBATE_PAUSED are broadcast
        """
        ack_task = await schedule_ack("deb_pause_1")

        async def fake_analyze(state):
            return guardian_interrupt_result.model_dump()

        with patched_debate_engine(fake_analyze):
            await stream_debate(
                "deb_pause_1",
                "BTC",
                {"summary": "test"},
                mock_manager,
                max_turns=1,
                stale_guardian=mock_stale_guardian,
            )
            await ack_task

        action_types = get_action_types(mock_manager)
        assert "DEBATE/GUARDIAN_INTERRUPT" in action_types
        assert "DEBATE/DEBATE_PAUSED" in action_types

    @pytest.mark.asyncio
    async def test_2_2_int_002_engine_resumes_on_ack(
        self, mock_manager, mock_stale_guardian, guardian_interrupt_result
    ):
        """[2-2-INT-002] @p0 Engine resumes after user acknowledges high-risk interrupt.

        Given a guardian that interrupts on turn 1 then returns safe
        When the user sends ACK and stream_debate continues
        Then DEBATE/DEBATE_PAUSED and DEBATE/DEBATE_RESUMED are both broadcast
        """
        ack_task = await schedule_ack("deb_resume_1")

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

        with patched_debate_engine(fake_analyze):
            await stream_debate(
                "deb_resume_1",
                "BTC",
                {"summary": "test"},
                mock_manager,
                max_turns=2,
                stale_guardian=mock_stale_guardian,
            )
            await ack_task

        action_types = get_action_types(mock_manager)
        assert "DEBATE/DEBATE_PAUSED" in action_types
        assert "DEBATE/DEBATE_RESUMED" in action_types

    @pytest.mark.asyncio
    async def test_2_2_int_003_engine_ends_on_critical_interrupt(
        self, mock_manager, mock_stale_guardian, critical_guardian_result
    ):
        """[2-2-INT-003] @p0 Engine ends debate on critical-risk interrupt with no resume.

        Given a guardian that returns a critical interrupt result
        When stream_debate runs
        Then status is "completed" and DEBATE_RESUMED is NOT broadcast
        """
        ack_task = await schedule_ack("deb_critical_1")

        async def fake_analyze(state):
            return critical_guardian_result.model_dump()

        with patched_debate_engine(fake_analyze):
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
        action_types = get_action_types(mock_manager)
        assert "DEBATE/DEBATE_PAUSED" in action_types
        assert "DEBATE/DEBATE_RESUMED" not in action_types

    @pytest.mark.asyncio
    async def test_2_2_int_004_system_message_injected_on_interrupt(
        self, mock_manager, mock_stale_guardian, guardian_interrupt_result
    ):
        """[2-2-INT-004] @p0 Guardian system message is injected into debate messages.

        Given a guardian that triggers a high-risk interrupt
        When stream_debate completes
        Then at least one guardian message with risk_level="high" is present
        """
        ack_task = await schedule_ack("deb_msg_1")

        async def fake_analyze(state):
            return guardian_interrupt_result.model_dump()

        with patched_debate_engine(fake_analyze):
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
        """[2-2-INT-005] @p1 Pause event is cleaned up when debate ends normally.

        Given a guardian that never interrupts
        When stream_debate completes all turns
        Then no pause_event remains for the debate_id
        """

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

        with patched_debate_engine(safe_analyze):
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
        """[2-2-INT-006] @p1 Pause event is cleaned up even when engine errors.

        Given a guardian that interrupts then causes a RuntimeError on next analyze
        When stream_debate raises
        Then no pause_event leaks for the debate_id
        """

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

        with patched_debate_engine(fake_analyze):
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
        """[2-2-INT-007] @p1 WS handler simulation sets pause_event on ACK.

        Given a debate with a registered, unset pause_event
        When the WS handler logic calls get_pause_event and set()
        Then the original event object is set
        """
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
        """[2-2-INT-008] @p1 Critical interrupt with ACK timeout ends the debate.

        Given a guardian that returns critical and a short ACK timeout
        When the user does not ACK in time
        Then the debate status is "completed" and no resume is broadcast
        """

        async def fake_analyze(state):
            return critical_guardian_result.model_dump()

        with patched_debate_engine(fake_analyze, ack_timeout=0.1):
            result = await stream_debate(
                "deb_critical_timeout",
                "BTC",
                {"summary": "test"},
                mock_manager,
                max_turns=4,
                stale_guardian=mock_stale_guardian,
            )

        assert result["status"] == "completed"
        action_types = get_action_types(mock_manager)
        assert "DEBATE/DEBATE_PAUSED" in action_types
        assert "DEBATE/DEBATE_RESUMED" not in action_types
        assert get_pause_event("deb_critical_timeout") is None

    @pytest.mark.asyncio
    async def test_2_2_int_009_pause_history_audit_log(
        self, mock_manager, mock_stale_guardian, guardian_interrupt_result
    ):
        """[2-2-INT-009] @p1 Pause history is recorded in the audit log.

        Given a guardian that triggers a high-risk interrupt
        When stream_debate completes with ACK
        Then pause_history contains at least one "paused" entry with risk_level and timestamp
        """
        ack_task = await schedule_ack("deb_audit_1")

        async def fake_analyze(state):
            return guardian_interrupt_result.model_dump()

        with patched_debate_engine(fake_analyze):
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
        """[2-2-INT-010] @p1 Stale data during pause triggers DATA_STALE event.

        Given a guardian that interrupts and data that becomes stale mid-debate
        When the freshness check interval is short
        Then DEBATE/DATA_STALE is broadcast alongside DEBATE/DEBATE_PAUSED
        """
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

        with patched_debate_engine(fake_analyze, freshness_interval=0.05):
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

        action_types = get_action_types(mock_manager)
        assert "DEBATE/DEBATE_PAUSED" in action_types
        assert "DEBATE/DATA_STALE" in action_types

    @pytest.mark.asyncio
    async def test_2_2_int_011_multiple_interrupts_in_one_debate(
        self, mock_manager, mock_stale_guardian, guardian_interrupt_result
    ):
        """[2-2-INT-011] @p1 Multiple guardian interrupts within a single debate.

        Given a guardian that interrupts on turns 1 and 2
        When the debate runs for 2 turns with recurring ACKs
        Then at least one pause/resume cycle is recorded
        """
        call_count = [0]

        async def fake_analyze(state):
            call_count[0] += 1
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

        with patched_debate_engine(fake_analyze):
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
        action_types = get_action_types(mock_manager)
        paused_count = action_types.count("DEBATE/DEBATE_PAUSED")
        assert paused_count >= 1


class TestDebateStateBackwardCompat:
    def test_2_2_unit_016_debate_state_backward_compatible(self):
        """[2-2-UNIT-016] @p1 DebateState TypedDict supports optional paused field.

        Given a DebateState without the 'paused' key
        When 'paused' is added and then removed
        Then the state remains valid throughout
        """
        from app.services.debate.state import DebateState

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

        state["paused"] = True
        assert state["paused"] is True

        state.pop("paused", None)
        assert "paused" not in state
