import asyncio
import pytest
from unittest.mock import MagicMock, AsyncMock

from app.services.debate.engine import (
    _pause_events,
    stream_debate,
    get_pause_event,
)
from tests.services.debate.test_helpers import (
    patched_debate_engine,
    get_action_types,
    schedule_ack,
)


def _safe_analyze(state):
    return {
        "should_interrupt": False,
        "risk_level": "low",
        "fallacy_type": None,
        "reason": "Safe",
        "summary_verdict": "Wait",
        "safe": True,
        "detailed_reasoning": "",
    }


class TestEndToEndDebateLifecycle:
    """Validate full debate flow: start → turns → Guardian interrupt → resume → completion."""

    def setup_method(self):
        _pause_events.clear()

    def teardown_method(self):
        _pause_events.clear()

    @pytest.mark.asyncio
    async def test_e2e_001_full_normal_completion(
        self, mock_manager, mock_stale_guardian
    ):
        """[E2E-001] @p0 Full debate completes normally with Guardian verdict."""

        async def safe_analyze(state):
            return {
                "should_interrupt": False,
                "risk_level": "low",
                "fallacy_type": None,
                "reason": "No issues detected",
                "summary_verdict": "Caution",
                "safe": True,
                "detailed_reasoning": "All arguments are balanced.",
            }

        with patched_debate_engine(safe_analyze) as mocks:
            result = await stream_debate(
                "deb_e2e_001",
                "BTC",
                {"summary": "Bitcoin market data loaded", "price": 45000},
                mock_manager,
                max_turns=2,
                stale_guardian=mock_stale_guardian,
            )

        assert result["status"] == "completed"
        assert result["current_turn"] == 2

        action_types = get_action_types(mock_manager)
        assert "DEBATE/STATUS_UPDATE" in action_types
        assert "DEBATE/GUARDIAN_VERDICT" in action_types
        assert "DEBATE/GUARDIAN_INTERRUPT" not in action_types
        assert "DEBATE/DEBATE_PAUSED" not in action_types
        assert "DEBATE/DEBATE_RESUMED" not in action_types

        status_updates = [
            c[0][1]
            for c in mock_manager.broadcast_to_debate.call_args_list
            if c[0][1]["type"] == "DEBATE/STATUS_UPDATE"
        ]
        statuses = [u["payload"]["status"] for u in status_updates]
        assert "running" in statuses
        assert "completed" in statuses

        assert get_pause_event("deb_e2e_001") is None

    @pytest.mark.asyncio
    async def test_e2e_002_interrupt_resume_completion(
        self, mock_manager, mock_stale_guardian
    ):
        """[E2E-002] @p0 Debate with Guardian interrupt → resume → normal completion."""

        ack_task = await schedule_ack("deb_e2e_002", delay=0.15)
        call_count = [0]

        async def fake_analyze(state):
            call_count[0] += 1
            if call_count[0] == 1:
                return {
                    "should_interrupt": True,
                    "risk_level": "high",
                    "fallacy_type": "overconfidence",
                    "reason": "Argument presents speculation as certainty.",
                    "summary_verdict": "High Risk",
                    "safe": False,
                    "detailed_reasoning": "Overconfidence without evidence.",
                }
            return _safe_analyze(state)

        with patched_debate_engine(fake_analyze, ack_timeout=2) as mocks:

            async def dynamic_bull(state):
                turn = state["current_turn"] + 1
                return {
                    "messages": state.get("messages", [])
                    + [{"role": "bull", "content": f"Bull arg turn {turn}"}],
                    "current_turn": turn,
                    "current_agent": "bear",
                }

            async def dynamic_bear(state):
                turn = state["current_turn"] + 1
                msgs = state.get("messages", [])
                last_bull = (
                    msgs[-1] if msgs else {"role": "bull", "content": "Bull arg"}
                )
                return {
                    "messages": msgs
                    + [{"role": "bear", "content": f"Bear counter turn {turn}"}],
                    "current_turn": turn,
                    "current_agent": "bull",
                }

            mocks["bull"].generate = AsyncMock(side_effect=dynamic_bull)
            mocks["bear"].generate = AsyncMock(side_effect=dynamic_bear)

            result = await stream_debate(
                "deb_e2e_002",
                "BTC",
                {"summary": "Bitcoin rallying"},
                mock_manager,
                max_turns=3,
                stale_guardian=mock_stale_guardian,
            )
            await ack_task

        assert result["status"] == "completed"

        action_types = get_action_types(mock_manager)
        assert "DEBATE/GUARDIAN_INTERRUPT" in action_types
        assert "DEBATE/DEBATE_PAUSED" in action_types
        assert "DEBATE/DEBATE_RESUMED" in action_types
        assert "DEBATE/GUARDIAN_VERDICT" in action_types

        interrupt_actions = [
            c[0][1]
            for c in mock_manager.broadcast_to_debate.call_args_list
            if c[0][1]["type"] == "DEBATE/GUARDIAN_INTERRUPT"
        ]
        assert len(interrupt_actions) >= 1
        assert interrupt_actions[0]["payload"]["riskLevel"] == "high"

        verdict_actions = [
            c[0][1]
            for c in mock_manager.broadcast_to_debate.call_args_list
            if c[0][1]["type"] == "DEBATE/GUARDIAN_VERDICT"
        ]
        assert len(verdict_actions) >= 1
        assert verdict_actions[0]["payload"]["totalInterrupts"] >= 1

        guardian_msgs = [
            m for m in result.get("messages", []) if m.get("role") == "guardian"
        ]
        assert len(guardian_msgs) >= 1

        pause_history = result.get("pause_history", [])
        paused_events = [e for e in pause_history if e["action"] == "paused"]
        resumed_events = [e for e in pause_history if e["action"] == "resumed"]
        assert len(paused_events) >= 1
        assert len(resumed_events) >= 1

        assert get_pause_event("deb_e2e_002") is None

    @pytest.mark.asyncio
    async def test_e2e_003_critical_interrupt_ends_debate(
        self, mock_manager, mock_stale_guardian
    ):
        """[E2E-003] @p0 Critical Guardian interrupt immediately terminates debate."""

        async def fake_analyze(state):
            return {
                "should_interrupt": True,
                "risk_level": "critical",
                "fallacy_type": "dangerous_advice",
                "reason": "Extremely dangerous financial advice detected.",
                "summary_verdict": "High Risk",
                "safe": False,
                "detailed_reasoning": "Critical risk to capital.",
            }

        with patched_debate_engine(fake_analyze, ack_timeout=0.5) as mocks:
            result = await stream_debate(
                "deb_e2e_003",
                "ETH",
                {"summary": "Ethereum data", "price": 3000},
                mock_manager,
                max_turns=6,
                stale_guardian=mock_stale_guardian,
            )

        assert result["status"] == "completed"

        action_types = get_action_types(mock_manager)
        assert "DEBATE/GUARDIAN_INTERRUPT" in action_types
        assert "DEBATE/DEBATE_PAUSED" in action_types
        assert "DEBATE/DEBATE_RESUMED" not in action_types

        assert get_pause_event("deb_e2e_003") is None

    @pytest.mark.asyncio
    async def test_e2e_004_sanitization_applied_to_output(
        self, mock_manager, mock_stale_guardian
    ):
        """[E2E-004] @p0 Sanitization redacts forbidden phrases in debate output."""

        bull_content_with_forbidden = (
            "Bitcoin is a guaranteed investment that will double your money."
        )
        bear_content = "I disagree with that assessment."

        async def safe_fn(state):
            return _safe_analyze(state)

        with patched_debate_engine(safe_fn) as mocks:
            mocks["bull"].generate = AsyncMock(
                return_value={
                    "messages": [
                        {"role": "bull", "content": bull_content_with_forbidden}
                    ],
                    "current_turn": 1,
                    "current_agent": "bear",
                }
            )
            mocks["bear"].generate = AsyncMock(
                return_value={
                    "messages": [
                        {"role": "bull", "content": bull_content_with_forbidden},
                        {"role": "bear", "content": bear_content},
                    ],
                    "current_turn": 2,
                    "current_agent": "bull",
                }
            )

            await stream_debate(
                "deb_e2e_004",
                "BTC",
                {"summary": "test"},
                mock_manager,
                max_turns=2,
                stale_guardian=mock_stale_guardian,
            )

        arg_actions = [
            c[0][1]
            for c in mock_manager.broadcast_to_debate.call_args_list
            if c[0][1]["type"] == "DEBATE/ARGUMENT_COMPLETE"
            and c[0][1]["payload"].get("agent") == "bull"
        ]
        assert len(arg_actions) >= 1
        broadcast_content = arg_actions[0]["payload"]["content"]
        assert "guaranteed" not in broadcast_content.lower()
        assert "[REDACTED]" in broadcast_content

    @pytest.mark.asyncio
    async def test_e2e_005_reasoning_graph_nodes_emitted(
        self, mock_manager, mock_stale_guardian
    ):
        """[E2E-005] @p1 Reasoning graph nodes emitted for each debate phase."""

        async def safe_fn(state):
            return _safe_analyze(state)

        with patched_debate_engine(safe_fn) as mocks:
            await stream_debate(
                "deb_e2e_005",
                "BTC",
                {"summary": "test"},
                mock_manager,
                max_turns=2,
                stale_guardian=mock_stale_guardian,
            )

        reasoning_actions = [
            c[0][1]
            for c in mock_manager.broadcast_to_debate.call_args_list
            if c[0][1]["type"] == "DEBATE/REASONING_NODE"
        ]
        node_types = [a["payload"]["nodeType"] for a in reasoning_actions]

        assert "data_input" in node_types
        assert node_types.count("bull_analysis") >= 2
        assert node_types.count("bear_counter") >= 2
        assert node_types.count("risk_check") >= 2

    @pytest.mark.asyncio
    async def test_e2e_006_multiple_interrupts_with_final_verdict(
        self, mock_manager, mock_stale_guardian
    ):
        """[E2E-006] @p1 Multiple interrupts with final verdict at completion."""

        async def recurring_ack():
            for _ in range(6):
                await asyncio.sleep(0.1)
                event = get_pause_event("deb_e2e_006")
                if event is not None:
                    event.set()

        ack_task = asyncio.create_task(recurring_ack())
        call_count = [0]

        async def fake_analyze(state):
            call_count[0] += 1
            if call_count[0] in (1, 3):
                return {
                    "should_interrupt": True,
                    "risk_level": "high",
                    "fallacy_type": "confirmation_bias",
                    "reason": "Confirmation bias detected in argument.",
                    "summary_verdict": "Caution",
                    "safe": False,
                    "detailed_reasoning": "Selective use of evidence.",
                }
            return _safe_analyze(state)

        with patched_debate_engine(fake_analyze, ack_timeout=2) as mocks:

            async def dynamic_bull(state):
                turn = state["current_turn"] + 1
                return {
                    "messages": state.get("messages", [])
                    + [{"role": "bull", "content": f"Bull arg turn {turn}"}],
                    "current_turn": turn,
                    "current_agent": "bear",
                }

            async def dynamic_bear(state):
                turn = state["current_turn"] + 1
                msgs = state.get("messages", [])
                return {
                    "messages": msgs
                    + [{"role": "bear", "content": f"Bear counter turn {turn}"}],
                    "current_turn": turn,
                    "current_agent": "bull",
                }

            mocks["bull"].generate = AsyncMock(side_effect=dynamic_bull)
            mocks["bear"].generate = AsyncMock(side_effect=dynamic_bear)

            result = await stream_debate(
                "deb_e2e_006",
                "BTC",
                {"summary": "test"},
                mock_manager,
                max_turns=4,
                stale_guardian=mock_stale_guardian,
            )

        ack_task.cancel()
        try:
            await ack_task
        except asyncio.CancelledError:
            pass

        assert result["status"] == "completed"

        action_types = get_action_types(mock_manager)
        interrupt_count = action_types.count("DEBATE/GUARDIAN_INTERRUPT")
        assert interrupt_count == 2

        verdict_actions = [
            c[0][1]
            for c in mock_manager.broadcast_to_debate.call_args_list
            if c[0][1]["type"] == "DEBATE/GUARDIAN_VERDICT"
        ]
        assert len(verdict_actions) >= 1
        assert verdict_actions[0]["payload"]["totalInterrupts"] == 2

        pause_history = result.get("pause_history", [])
        paused_events = [e for e in pause_history if e["action"] == "paused"]
        resumed_events = [e for e in pause_history if e["action"] == "resumed"]
        assert len(paused_events) == 2
        assert len(resumed_events) == 2

        guardian_msgs = [
            m for m in result.get("messages", []) if m.get("role") == "guardian"
        ]
        assert len(guardian_msgs) == 2

    @pytest.mark.asyncio
    async def test_e2e_007_redis_state_lifecycle(
        self, mock_manager, mock_stale_guardian
    ):
        """[E2E-007] @p1 Redis state transitions correctly through debate lifecycle."""

        async def safe_fn(state):
            return _safe_analyze(state)

        with patched_debate_engine(safe_fn) as mocks:
            await stream_debate(
                "deb_e2e_007",
                "BTC",
                {"summary": "test"},
                mock_manager,
                max_turns=2,
                stale_guardian=mock_stale_guardian,
            )

        save_calls = mocks["stream_state"].save_state.call_args_list
        saved_statuses = [c[0][1].get("status") for c in save_calls]

        assert "running" in saved_statuses
        assert "completed" in saved_statuses
        assert saved_statuses[-1] == "completed"

    @pytest.mark.asyncio
    async def test_e2e_008_turn_alternation_enforced(
        self, mock_manager, mock_stale_guardian
    ):
        """[E2E-008] @p1 Bull and Bear strictly alternate turns."""

        async def safe_fn(state):
            return _safe_analyze(state)

        with patched_debate_engine(safe_fn) as mocks:

            async def dynamic_bull(state):
                turn = state["current_turn"] + 1
                return {
                    "messages": state.get("messages", [])
                    + [{"role": "bull", "content": f"Bull arg turn {turn}"}],
                    "current_turn": turn,
                    "current_agent": "bear",
                }

            async def dynamic_bear(state):
                turn = state["current_turn"] + 1
                msgs = state.get("messages", [])
                return {
                    "messages": msgs
                    + [{"role": "bear", "content": f"Bear counter turn {turn}"}],
                    "current_turn": turn,
                    "current_agent": "bull",
                }

            mocks["bull"].generate = AsyncMock(side_effect=dynamic_bull)
            mocks["bear"].generate = AsyncMock(side_effect=dynamic_bear)

            await stream_debate(
                "deb_e2e_008",
                "BTC",
                {"summary": "test"},
                mock_manager,
                max_turns=4,
                stale_guardian=mock_stale_guardian,
            )

        turn_change_actions = [
            c[0][1]
            for c in mock_manager.broadcast_to_debate.call_args_list
            if c[0][1]["type"] == "DEBATE/TURN_CHANGE"
        ]
        next_agents = [a["payload"]["currentAgent"] for a in turn_change_actions]
        assert next_agents == ["bear", "bull", "bear", "bull"]
