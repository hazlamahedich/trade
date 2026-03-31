import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from app.services.debate.agents.guardian import (
    GuardianAgent,
    GuardianAnalysisResult,
    FALLACY_CATEGORIES,
    RISK_LEVELS,
)
from tests.services.debate.conftest import make_guardian_result


class TestGuardianAgentAnalyze:
    @pytest.mark.asyncio
    async def test_2_1_unit_001_detects_fallacy_returns_interrupt(
        self, debate_state_with_arguments
    ):
        interrupt_result = make_guardian_result(
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
        safe_result = make_guardian_result()

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
        result = make_guardian_result(
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
        result_with_forbidden = make_guardian_result(
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


class TestGetLlmConfigWiring:
    @pytest.mark.asyncio
    async def test_2_1_unit_037_uses_config_model_and_temperature(self):
        mock_llm = MagicMock()
        mock_llm.with_structured_output.return_value = mock_llm

        with patch(
            "app.services.debate.agents.guardian.get_llm_with_failover",
            new_callable=AsyncMock,
            return_value=mock_llm,
        ) as mock_failover:
            mock_prompt = MagicMock()
            chain_mock = MagicMock()
            chain_mock.ainvoke = AsyncMock(return_value=make_guardian_result())
            mock_prompt.__or__ = MagicMock(return_value=chain_mock)

            with patch(
                "app.services.debate.agents.guardian.ChatPromptTemplate"
            ) as mock_prompt_class:
                mock_prompt_class.from_template.return_value = mock_prompt

                with patch("app.config.settings") as mock_settings:
                    mock_settings.guardian_llm_model = "gpt-4o"
                    mock_settings.guardian_llm_temperature = 0.1

                    agent = GuardianAgent()
                    await agent.analyze(
                        {
                            "asset": "BTC",
                            "market_context": {},
                            "messages": [],
                            "current_turn": 0,
                            "max_turns": 6,
                            "current_agent": "bull",
                            "status": "running",
                        }
                    )

                mock_failover.assert_called_once()
                call_kwargs = mock_failover.call_args
                assert call_kwargs.kwargs["model"] == "gpt-4o"
                assert call_kwargs.kwargs["temperature"] == 0.1


class TestGuardianWithMissingOptionalFields:
    @pytest.mark.asyncio
    async def test_2_1_unit_039_state_without_market_context(self):
        state = {
            "asset": "BTC",
            "market_context": {},
            "messages": [{"role": "bull", "content": "Test"}],
            "current_turn": 1,
            "max_turns": 6,
            "current_agent": "bear",
            "status": "running",
        }

        with patch(
            "app.services.debate.agents.guardian.ChatPromptTemplate"
        ) as mock_prompt_class:
            chain_mock = MagicMock()
            chain_mock.ainvoke = AsyncMock(return_value=make_guardian_result())

            mock_prompt = MagicMock()
            mock_prompt.__or__ = MagicMock(return_value=chain_mock)
            mock_prompt_class.from_template.return_value = mock_prompt

            mock_llm = MagicMock()
            mock_llm.with_structured_output.return_value = mock_llm

            agent = GuardianAgent(llm=mock_llm)
            analysis = await agent.analyze(state)

        assert analysis["safe"] is True

    @pytest.mark.asyncio
    async def test_2_1_unit_040_state_with_guardian_fields_present(self):
        state = {
            "asset": "BTC",
            "market_context": {"price": 50000},
            "messages": [{"role": "bull", "content": "Moon!"}],
            "current_turn": 2,
            "max_turns": 6,
            "current_agent": "bear",
            "status": "running",
            "guardian_verdict": "Caution",
            "guardian_interrupts": [
                {"turn": 1, "agent": "bull", "risk_level": "medium"}
            ],
            "interrupted": False,
        }

        with patch(
            "app.services.debate.agents.guardian.ChatPromptTemplate"
        ) as mock_prompt_class:
            chain_mock = MagicMock()
            chain_mock.ainvoke = AsyncMock(
                return_value=make_guardian_result(
                    should_interrupt=True,
                    risk_level="high",
                    fallacy_type="overconfidence",
                    reason="Overly optimistic without basis",
                    summary_verdict="High Risk",
                    safe=False,
                    detailed_reasoning="No data backing 'moon' claim",
                )
            )

            mock_prompt = MagicMock()
            mock_prompt.__or__ = MagicMock(return_value=chain_mock)
            mock_prompt_class.from_template.return_value = mock_prompt

            mock_llm = MagicMock()
            mock_llm.with_structured_output.return_value = mock_llm

            agent = GuardianAgent(llm=mock_llm)
            analysis = await agent.analyze(state)

        assert analysis["should_interrupt"] is True
        assert state["guardian_interrupts"][0]["risk_level"] == "medium"
