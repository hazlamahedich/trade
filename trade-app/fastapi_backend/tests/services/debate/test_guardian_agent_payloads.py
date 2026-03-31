import json
import pytest

from app.services.debate.ws_schemas import (
    GuardianInterruptPayload,
    GuardianVerdictPayload,
)


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


class TestGuardianPayloadRoundTrip:
    def test_2_1_unit_033_interrupt_round_trip_serialization(self):
        payload = GuardianInterruptPayload(
            debate_id="deb_roundtrip",
            risk_level="critical",
            reason="Dangerous leverage advice",
            fallacy_type="dangerous_advice",
            original_agent="bull",
            summary_verdict="High Risk",
            turn=5,
        )
        serialized = payload.model_dump(by_alias=True)
        deserialized = GuardianInterruptPayload(**serialized)
        assert deserialized.debate_id == "deb_roundtrip"
        assert deserialized.risk_level == "critical"
        assert deserialized.fallacy_type == "dangerous_advice"
        assert deserialized.turn == 5

    def test_2_1_unit_034_verdict_round_trip_serialization(self):
        payload = GuardianVerdictPayload(
            debate_id="deb_vrt",
            verdict="Caution",
            risk_level="medium",
            summary="Multiple concerns noted",
            reasoning="Extended analysis of debate quality",
            total_interrupts=4,
        )
        serialized = payload.model_dump(by_alias=True)
        deserialized = GuardianVerdictPayload(**serialized)
        assert deserialized.debate_id == "deb_vrt"
        assert deserialized.verdict == "Caution"
        assert deserialized.total_interrupts == 4

    def test_2_1_unit_035_interrupt_json_compatible(self):
        payload = GuardianInterruptPayload(
            debate_id="deb_json",
            risk_level="medium",
            reason="Confirmation bias detected",
            fallacy_type="confirmation_bias",
            original_agent="bear",
            summary_verdict="Caution",
            turn=2,
        )
        json_str = json.dumps(payload.model_dump(by_alias=True))
        parsed = json.loads(json_str)
        assert parsed["debateId"] == "deb_json"
        assert parsed["fallacyType"] == "confirmation_bias"

    def test_2_1_unit_036_verdict_json_compatible(self):
        payload = GuardianVerdictPayload(
            debate_id="deb_vjson",
            verdict="High Risk",
            risk_level="critical",
            summary="Critical risks found",
            reasoning="Multiple dangerous patterns",
            total_interrupts=7,
        )
        json_str = json.dumps(payload.model_dump(by_alias=True))
        parsed = json.loads(json_str)
        assert parsed["debateId"] == "deb_vjson"
        assert parsed["totalInterrupts"] == 7
