import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from app.services.debate.agents.guardian import (
    GuardianAgent,
    GuardianAnalysisResult,
    FALLACY_CATEGORIES,
    RISK_LEVELS,
)
from app.services.debate.ws_schemas import (
    GuardianInterruptPayload,
    GuardianVerdictPayload,
    WebSocketAction,
)
from app.services.debate.streaming import (
    send_guardian_interrupt,
    send_guardian_verdict,
    DebateConnectionManager,
)


class TestGuardianAgentAnalyze:
    @pytest.mark.asyncio
    async def test_2_1_unit_001_detects_fallacy_returns_interrupt(
        self, debate_state_with_arguments
    ):
        interrupt_result = GuardianAnalysisResult(
            should_interrupt=True,
            risk_level="high",
            fallacy_type="overconfidence",
            reason="The argument treats prediction as certainty.",
            summary_verdict="High Risk",
            safe=False,
            detailed_reasoning="Overconfidence detected.",
        )

        with patch(
            "app.services.debate.agents.guardian.ChatPromptTemplate"
        ) as mock_prompt_class:
            chain_mock = MagicMock()
            chain_mock.ainvoke = AsyncMock(return_value=interrupt_result)

            mock_prompt = MagicMock()
            mock_prompt.__or__ = MagicMock(return_value=chain_mock)
            mock_prompt_class.from_template.return_value = mock_prompt

            mock_llm = MagicMock()
            mock_llm.with_structured_output.return_value = mock_llm

            agent = GuardianAgent(llm=mock_llm)
            result = await agent.analyze(debate_state_with_arguments)

        assert result["should_interrupt"] is True
        assert result["risk_level"] == "high"
        assert result["fallacy_type"] == "overconfidence"
        assert result["safe"] is False
        assert result["summary_verdict"] == "High Risk"

    @pytest.mark.asyncio
    async def test_2_1_unit_002_safe_arguments_no_interrupt(
        self, debate_state_with_arguments
    ):
        safe_result = GuardianAnalysisResult(
            should_interrupt=False,
            risk_level="low",
            fallacy_type=None,
            reason="No issues detected.",
            summary_verdict="Wait",
            safe=True,
            detailed_reasoning="",
        )

        with patch(
            "app.services.debate.agents.guardian.ChatPromptTemplate"
        ) as mock_prompt_class:
            chain_mock = MagicMock()
            chain_mock.ainvoke = AsyncMock(return_value=safe_result)

            mock_prompt = MagicMock()
            mock_prompt.__or__ = MagicMock(return_value=chain_mock)
            mock_prompt_class.from_template.return_value = mock_prompt

            mock_llm = MagicMock()
            mock_llm.with_structured_output.return_value = mock_llm

            agent = GuardianAgent(llm=mock_llm)
            result = await agent.analyze(debate_state_with_arguments)

        assert result["should_interrupt"] is False
        assert result["safe"] is True
        assert result["risk_level"] == "low"

    @pytest.mark.asyncio
    async def test_2_1_unit_003_capital_preservation_priority(self, debate_state):
        from app.services.debate.agents.guardian import GUARDIAN_SYSTEM_PROMPT

        assert "Capital Preservation" in GUARDIAN_SYSTEM_PROMPT
        assert "#1 PRIORITY" in GUARDIAN_SYSTEM_PROMPT

    @pytest.mark.asyncio
    async def test_2_1_unit_004_structured_output_all_fields(
        self, debate_state_with_arguments
    ):
        result = GuardianAnalysisResult(
            should_interrupt=True,
            risk_level="critical",
            fallacy_type="dangerous_advice",
            reason="Implies reckless action.",
            summary_verdict="High Risk",
            safe=False,
            detailed_reasoning="The argument implies the user should act recklessly.",
        )

        dumped = result.model_dump()
        assert "should_interrupt" in dumped
        assert "risk_level" in dumped
        assert "fallacy_type" in dumped
        assert "reason" in dumped
        assert "summary_verdict" in dumped
        assert "safe" in dumped
        assert "detailed_reasoning" in dumped

    @pytest.mark.asyncio
    async def test_2_1_unit_005_fallacy_categories_defined(self):
        expected = [
            "unsubstantiated_claim",
            "confirmation_bias",
            "overconfidence",
            "cognitive_bias",
            "dangerous_advice",
        ]
        assert FALLACY_CATEGORIES == expected

    @pytest.mark.asyncio
    async def test_2_1_unit_006_risk_levels_defined(self):
        assert RISK_LEVELS == ["low", "medium", "high", "critical"]

    @pytest.mark.asyncio
    async def test_2_1_unit_007_llm_failure_graceful_degradation(
        self, debate_state_with_arguments
    ):
        with patch(
            "app.services.debate.agents.guardian.ChatPromptTemplate"
        ) as mock_prompt_class:
            chain_mock = MagicMock()
            chain_mock.ainvoke = AsyncMock(side_effect=Exception("LLM timeout"))

            mock_prompt = MagicMock()
            mock_prompt.__or__ = MagicMock(return_value=chain_mock)
            mock_prompt_class.from_template.return_value = mock_prompt

            mock_llm = MagicMock()
            mock_llm.with_structured_output.return_value = mock_llm

            agent = GuardianAgent(llm=mock_llm)
            with pytest.raises(Exception, match="LLM timeout"):
                await agent.analyze(debate_state_with_arguments)

    @pytest.mark.asyncio
    async def test_2_1_unit_008_non_structured_output_fallback(
        self, debate_state_with_arguments
    ):
        with patch(
            "app.services.debate.agents.guardian.ChatPromptTemplate"
        ) as mock_prompt_class:
            chain_mock = MagicMock()
            chain_mock.ainvoke = AsyncMock(return_value="not a pydantic model")

            mock_prompt = MagicMock()
            mock_prompt.__or__ = MagicMock(return_value=chain_mock)
            mock_prompt_class.from_template.return_value = mock_prompt

            mock_llm = MagicMock()
            mock_llm.with_structured_output.return_value = mock_llm

            agent = GuardianAgent(llm=mock_llm)
            result = await agent.analyze(debate_state_with_arguments)

        assert result["should_interrupt"] is False
        assert result["safe"] is True

    @pytest.mark.asyncio
    async def test_2_1_unit_009_sanitize_applied_to_output(
        self, debate_state_with_arguments
    ):
        result_with_forbidden = GuardianAnalysisResult(
            should_interrupt=True,
            risk_level="high",
            fallacy_type="dangerous_advice",
            reason="This is a guaranteed profit opportunity.",
            summary_verdict="High Risk",
            safe=False,
            detailed_reasoning="Contains guaranteed claims.",
        )

        with patch(
            "app.services.debate.agents.guardian.ChatPromptTemplate"
        ) as mock_prompt_class:
            chain_mock = MagicMock()
            chain_mock.ainvoke = AsyncMock(return_value=result_with_forbidden)

            mock_prompt = MagicMock()
            mock_prompt.__or__ = MagicMock(return_value=chain_mock)
            mock_prompt_class.from_template.return_value = mock_prompt

            mock_llm = MagicMock()
            mock_llm.with_structured_output.return_value = mock_llm

            agent = GuardianAgent(llm=mock_llm)
            result = await agent.analyze(debate_state_with_arguments)

        assert "guaranteed" not in result["reason"].lower()
        assert "[REDACTED]" in result["reason"]


class TestGuardianInterruptPayload:
    def test_2_1_unit_010_camel_case_serialization(self):
        payload = GuardianInterruptPayload(
            debate_id="deb_123",
            risk_level="high",
            reason="Overconfidence detected",
            fallacy_type="overconfidence",
            original_agent="bull",
            summary_verdict="High Risk",
            turn=3,
        )
        data = payload.model_dump(by_alias=True)

        assert "debateId" in data
        assert "riskLevel" in data
        assert "fallacyType" in data
        assert "originalAgent" in data
        assert "summaryVerdict" in data
        assert data["riskLevel"] == "high"
        assert data["originalAgent"] == "bull"

    def test_2_1_unit_011_optional_fields_default(self):
        payload = GuardianInterruptPayload(
            debate_id="deb_123",
            risk_level="low",
            reason="Safe",
            original_agent="bear",
            summary_verdict="Wait",
        )
        data = payload.model_dump(by_alias=True)
        assert data["fallacyType"] is None
        assert data["turn"] is None


class TestGuardianVerdictPayload:
    def test_2_1_unit_012_camel_case_serialization(self):
        payload = GuardianVerdictPayload(
            debate_id="deb_123",
            verdict="Caution",
            risk_level="medium",
            summary="Some concerns noted",
            reasoning="Detailed reasoning here",
            total_interrupts=2,
        )
        data = payload.model_dump(by_alias=True)

        assert "debateId" in data
        assert "riskLevel" in data
        assert "totalInterrupts" in data
        assert data["totalInterrupts"] == 2

    def test_2_1_unit_013_default_total_interrupts(self):
        payload = GuardianVerdictPayload(
            debate_id="deb_123",
            verdict="Wait",
            risk_level="low",
            summary="No issues",
            reasoning="All clear",
        )
        data = payload.model_dump(by_alias=True)
        assert data["totalInterrupts"] == 0


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
        from app.services.debate.ws_schemas import WebSocketActionType
        import typing

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
