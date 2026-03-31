import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from app.services.debate.agents.guardian import (
    GuardianAgent,
    GuardianAnalysisResult,
)
from tests.services.debate.conftest import make_guardian_result


class TestGuardianAnalysisResultConstraints:
    def test_2_1_unit_027_invalid_risk_level_rejected(self):
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            GuardianAnalysisResult(
                should_interrupt=True,
                risk_level="extreme",
                fallacy_type="overconfidence",
                reason="test",
                summary_verdict="High Risk",
                safe=False,
                detailed_reasoning="",
            )

    def test_2_1_unit_028_invalid_fallacy_type_rejected(self):
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            GuardianAnalysisResult(
                should_interrupt=True,
                risk_level="high",
                fallacy_type="made_up_fallacy",
                reason="test",
                summary_verdict="High Risk",
                safe=False,
                detailed_reasoning="",
            )

    def test_2_1_unit_029_invalid_summary_verdict_rejected(self):
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            GuardianAnalysisResult(
                should_interrupt=True,
                risk_level="high",
                fallacy_type="overconfidence",
                reason="test",
                summary_verdict="Maybe",
                safe=False,
                detailed_reasoning="",
            )

    def test_2_1_unit_030_all_valid_risk_levels(self):
        for level in ["low", "medium", "high", "critical"]:
            result = GuardianAnalysisResult(
                should_interrupt=False,
                risk_level=level,
                fallacy_type=None,
                reason="test",
                summary_verdict="Wait",
                safe=True,
                detailed_reasoning="",
            )
            assert result.risk_level == level

    def test_2_1_unit_031_all_valid_fallacy_types(self):
        for ft in [
            "unsubstantiated_claim",
            "confirmation_bias",
            "overconfidence",
            "cognitive_bias",
            "dangerous_advice",
        ]:
            result = GuardianAnalysisResult(
                should_interrupt=True,
                risk_level="high",
                fallacy_type=ft,
                reason="test",
                summary_verdict="High Risk",
                safe=False,
                detailed_reasoning="",
            )
            assert result.fallacy_type == ft

    def test_2_1_unit_032_all_valid_summary_verdicts(self):
        for verdict in ["Wait", "Caution", "High Risk"]:
            result = GuardianAnalysisResult(
                should_interrupt=False,
                risk_level="low",
                fallacy_type=None,
                reason="test",
                summary_verdict=verdict,
                safe=True,
                detailed_reasoning="",
            )
            assert result.summary_verdict == verdict


class TestIndividualFallacyCategories:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "fallacy",
        [
            "unsubstantiated_claim",
            "confirmation_bias",
            "overconfidence",
            "cognitive_bias",
            "dangerous_advice",
        ],
    )
    async def test_2_1_unit_038_each_fallacy_detected(
        self, debate_state_with_arguments, fallacy
    ):
        result = make_guardian_result(
            should_interrupt=True,
            risk_level="high",
            fallacy_type=fallacy,
            reason=f"Detected {fallacy}",
            summary_verdict="High Risk",
            safe=False,
            detailed_reasoning=f"Analysis for {fallacy}",
        )

        with patch(
            "app.services.debate.agents.guardian.ChatPromptTemplate"
        ) as mock_prompt_class:
            chain_mock = MagicMock()
            chain_mock.ainvoke = AsyncMock(return_value=result)

            mock_prompt = MagicMock()
            mock_prompt.__or__ = MagicMock(return_value=chain_mock)
            mock_prompt_class.from_template.return_value = mock_prompt

            mock_llm = MagicMock()
            mock_llm.with_structured_output.return_value = mock_llm

            agent = GuardianAgent(llm=mock_llm)
            analysis = await agent.analyze(debate_state_with_arguments)

        assert analysis["fallacy_type"] == fallacy
        assert analysis["should_interrupt"] is True
        assert analysis["safe"] is False
