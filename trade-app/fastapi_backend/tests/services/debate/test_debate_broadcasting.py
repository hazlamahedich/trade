import pytest

from app.services.debate.streaming import (
    send_debate_paused,
    send_debate_resumed,
)
from app.services.debate.ws_schemas import (
    DebatePausedPayload,
    DebateResumedPayload,
)


class TestSendDebatePaused:
    @pytest.mark.asyncio
    async def test_2_2_unit_010_broadcasts_correct_payload(self, mock_manager):
        """[2-2-UNIT-010] @p1 send_debate_paused broadcasts DEBATE_PAUSED with correct payload.

        Given a DebateConnectionManager mock
        When send_debate_paused is called with reason, risk_level, and turn
        Then a DEBATE/DEBATE_PAUSED message is broadcast with the correct fields
        """
        await send_debate_paused(
            mock_manager,
            "deb_123",
            reason="Overconfidence detected",
            risk_level="high",
            summary_verdict="High Risk",
            turn=2,
        )

        mock_manager.broadcast_to_debate.assert_called_once()
        call_args = mock_manager.broadcast_to_debate.call_args
        action_data = call_args[0][1]

        assert action_data["type"] == "DEBATE/DEBATE_PAUSED"
        assert action_data["payload"]["debateId"] == "deb_123"
        assert action_data["payload"]["riskLevel"] == "high"
        assert action_data["payload"]["summaryVerdict"] == "High Risk"
        assert action_data["payload"]["turn"] == 2


class TestSendDebateResumed:
    @pytest.mark.asyncio
    async def test_2_2_unit_011_broadcasts_correct_payload(self, mock_manager):
        """[2-2-UNIT-011] @p1 send_debate_resumed broadcasts DEBATE_RESUMED with correct payload.

        Given a DebateConnectionManager mock
        When send_debate_resumed is called with debate_id and turn
        Then a DEBATE/DEBATE_RESUMED message is broadcast with the correct fields
        """
        await send_debate_resumed(
            mock_manager,
            "deb_123",
            turn=2,
        )

        mock_manager.broadcast_to_debate.assert_called_once()
        call_args = mock_manager.broadcast_to_debate.call_args
        action_data = call_args[0][1]

        assert action_data["type"] == "DEBATE/DEBATE_RESUMED"
        assert action_data["payload"]["debateId"] == "deb_123"
        assert action_data["payload"]["turn"] == 2


class TestDebatePausedPayloadSerialization:
    def test_2_2_unit_012_camel_case_serialization(self):
        """[2-2-UNIT-012] @p2 DebatePausedPayload serializes to camelCase.

        Given a DebatePausedPayload with snake_case fields
        When model_dump(by_alias=True) is called
        Then the output uses camelCase keys
        """
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
        """[2-2-UNIT-013] @p2 DebateResumedPayload serializes to camelCase.

        Given a DebateResumedPayload with snake_case fields
        When model_dump(by_alias=True) is called
        Then the output uses camelCase keys
        """
        payload = DebateResumedPayload(
            debate_id="deb_123",
            turn=3,
        )

        serialized = payload.model_dump(by_alias=True)
        assert "debateId" in serialized
        assert serialized["debateId"] == "deb_123"
        assert serialized["turn"] == 3
