import typing
import pytest
from unittest.mock import MagicMock

from app.services.debate.agents.guardian import GuardianAgent
from app.services.debate.ws_schemas import WebSocketAction, WebSocketActionType


class TestDebateStateBackwardCompat:
    def test_2_1_unit_016_old_state_without_guardian_fields(self):
        state: dict = {
            "asset": "bitcoin",
            "market_context": {},
            "messages": [],
            "current_turn": 0,
            "max_turns": 6,
            "current_agent": "bull",
            "status": "running",
        }

        assert state["asset"] == "bitcoin"
        assert "guardian_verdict" not in state
        assert "guardian_interrupts" not in state
        assert "interrupted" not in state

    def test_2_1_unit_017_new_state_with_guardian_fields(self):
        state: dict = {
            "asset": "bitcoin",
            "market_context": {},
            "messages": [],
            "current_turn": 0,
            "max_turns": 6,
            "current_agent": "bull",
            "status": "running",
            "guardian_verdict": "Caution",
            "guardian_interrupts": [{"turn": 1, "agent": "bull", "risk_level": "high"}],
            "interrupted": False,
        }

        assert state["guardian_verdict"] == "Caution"
        assert len(state["guardian_interrupts"]) == 1


class TestWebSocketActionTypeGuardian:
    def test_2_1_unit_018_guardian_action_types_in_literal(self):
        args = typing.get_args(WebSocketActionType)

        assert "DEBATE/GUARDIAN_INTERRUPT" in args
        assert "DEBATE/GUARDIAN_VERDICT" in args

    def test_2_1_unit_019_guardian_interrupt_action_valid(self):
        action = WebSocketAction(
            type="DEBATE/GUARDIAN_INTERRUPT",
            payload={"debateId": "deb_123", "riskLevel": "high"},
        )
        assert action.type == "DEBATE/GUARDIAN_INTERRUPT"

    def test_2_1_unit_020_guardian_verdict_action_valid(self):
        action = WebSocketAction(
            type="DEBATE/GUARDIAN_VERDICT",
            payload={"debateId": "deb_123", "verdict": "Caution"},
        )
        assert action.type == "DEBATE/GUARDIAN_VERDICT"


class TestGuardianAuditLog:
    @pytest.mark.asyncio
    async def test_2_1_unit_021_interrupts_accumulate(self, debate_state):
        interrupts = [
            {"turn": 1, "agent": "bull", "risk_level": "high", "reason": "test"},
            {"turn": 3, "agent": "bear", "risk_level": "medium", "reason": "test2"},
        ]
        state = {**debate_state, "guardian_interrupts": interrupts}

        assert len(state["guardian_interrupts"]) == 2
        assert state["guardian_interrupts"][0]["turn"] == 1
        assert state["guardian_interrupts"][1]["turn"] == 3


class TestGuardianConfigSettings:
    def test_2_1_unit_022_guardian_settings_defaults(self):
        from app.config import Settings

        fields = Settings.model_fields
        assert "guardian_llm_model" in fields
        assert "guardian_llm_temperature" in fields
        assert "guardian_enabled" in fields
        assert fields["guardian_llm_model"].default == "gpt-4o-mini"
        assert fields["guardian_llm_temperature"].default == 0.3
        assert fields["guardian_enabled"].default is True


class TestFormatAllArgumentsEdgeCases:
    @pytest.mark.asyncio
    async def test_2_1_unit_023_empty_messages(self, debate_state):
        agent = GuardianAgent(llm=MagicMock())
        result = agent._format_all_arguments(debate_state)
        assert result == "No arguments yet."

    @pytest.mark.asyncio
    async def test_2_1_unit_024_single_message(self, debate_state):
        state = {
            **debate_state,
            "messages": [{"role": "bull", "content": "BTC is bullish."}],
        }
        agent = GuardianAgent(llm=MagicMock())
        result = agent._format_all_arguments(state)
        assert "[BULL]: BTC is bullish." in result

    @pytest.mark.asyncio
    async def test_2_1_unit_025_multiple_messages_formatted(self):
        state = {
            "asset": "ETH",
            "market_context": {},
            "messages": [
                {"role": "bull", "content": "ETH will rise."},
                {"role": "bear", "content": "ETH faces headwinds."},
                {"role": "bull", "content": "Institutional buying supports ETH."},
            ],
            "current_turn": 3,
            "max_turns": 6,
            "current_agent": "bear",
            "status": "running",
        }
        agent = GuardianAgent(llm=MagicMock())
        result = agent._format_all_arguments(state)
        assert "[BULL]: ETH will rise." in result
        assert "[BEAR]: ETH faces headwinds." in result
        assert "[BULL]: Institutional buying supports ETH." in result

    @pytest.mark.asyncio
    async def test_2_1_unit_026_message_missing_role(self):
        state = {
            "asset": "BTC",
            "market_context": {},
            "messages": [{"content": "Orphan message"}],
            "current_turn": 1,
            "max_turns": 6,
            "current_agent": "bull",
            "status": "running",
        }
        agent = GuardianAgent(llm=MagicMock())
        result = agent._format_all_arguments(state)
        assert "[UNKNOWN]: Orphan message" in result
