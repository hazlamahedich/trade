import pytest
from unittest.mock import MagicMock, AsyncMock

from app.services.debate.streaming import (
    send_guardian_interrupt,
    send_guardian_verdict,
    DebateConnectionManager,
)


class TestSendGuardianInterrupt:
    @pytest.mark.asyncio
    async def test_2_1_unit_014_broadcasts_correct_action(self):
        manager = MagicMock(spec=DebateConnectionManager)
        manager.broadcast_to_debate = AsyncMock()

        await send_guardian_interrupt(
            manager,
            "deb_123",
            risk_level="critical",
            reason="Dangerous advice detected",
            fallacy_type="dangerous_advice",
            original_agent="bull",
            summary_verdict="High Risk",
            turn=2,
        )

        manager.broadcast_to_debate.assert_called_once()
        call_args = manager.broadcast_to_debate.call_args
        action_data = call_args[0][1]

        assert action_data["type"] == "DEBATE/GUARDIAN_INTERRUPT"
        assert action_data["payload"]["riskLevel"] == "critical"
        assert action_data["payload"]["originalAgent"] == "bull"
        assert action_data["payload"]["fallacyType"] == "dangerous_advice"


class TestSendGuardianVerdict:
    @pytest.mark.asyncio
    async def test_2_1_unit_015_broadcasts_correct_action(self):
        manager = MagicMock(spec=DebateConnectionManager)
        manager.broadcast_to_debate = AsyncMock()

        await send_guardian_verdict(
            manager,
            "deb_123",
            verdict="Caution",
            risk_level="medium",
            summary="Some risks identified",
            reasoning="Multiple fallacies detected during debate",
            total_interrupts=3,
        )

        manager.broadcast_to_debate.assert_called_once()
        call_args = manager.broadcast_to_debate.call_args
        action_data = call_args[0][1]

        assert action_data["type"] == "DEBATE/GUARDIAN_VERDICT"
        assert action_data["payload"]["verdict"] == "Caution"
        assert action_data["payload"]["totalInterrupts"] == 3
