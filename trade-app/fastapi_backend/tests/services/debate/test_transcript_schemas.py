import pytest
from datetime import datetime, timezone

from app.services.debate.vote_schemas import (
    TranscriptMessage,
    DebateResultResponse,
)


class TestTranscriptMessage:
    @pytest.mark.p1
    def test_valid_message(self):
        msg = TranscriptMessage(role="bull", content="BTC will rise")
        assert msg.role == "bull"
        assert msg.content == "BTC will rise"

    @pytest.mark.p1
    def test_serialization(self):
        msg = TranscriptMessage(role="bear", content="BTC will fall")
        dumped = msg.model_dump()
        assert dumped["role"] == "bear"
        assert dumped["content"] == "BTC will fall"


class TestDebateResultResponseTranscript:
    @pytest.mark.p0
    def test_transcript_none_default(self):
        resp = DebateResultResponse(
            debate_id="deb_abc",
            asset="btc",
            status="completed",
            current_turn=6,
            max_turns=6,
            created_at=datetime.now(timezone.utc),
        )
        assert resp.transcript is None
        dumped = resp.model_dump(by_alias=True)
        assert dumped["transcript"] is None

    @pytest.mark.p0
    def test_transcript_populated(self):
        messages = [
            TranscriptMessage(role="bull", content="Rising trend"),
            TranscriptMessage(role="bear", content="Bearish signal"),
        ]
        resp = DebateResultResponse(
            debate_id="deb_abc",
            asset="btc",
            status="completed",
            current_turn=6,
            max_turns=6,
            created_at=datetime.now(timezone.utc),
            transcript=messages,
        )
        assert resp.transcript is not None
        assert len(resp.transcript) == 2
        dumped = resp.model_dump(by_alias=True)
        assert len(dumped["transcript"]) == 2
        assert dumped["transcript"][0]["role"] == "bull"

    @pytest.mark.p1
    def test_transcript_empty_list(self):
        resp = DebateResultResponse(
            debate_id="deb_abc",
            asset="btc",
            status="completed",
            current_turn=6,
            max_turns=6,
            created_at=datetime.now(timezone.utc),
            transcript=[],
        )
        assert resp.transcript == []
        dumped = resp.model_dump(by_alias=True)
        assert dumped["transcript"] == []

    @pytest.mark.p1
    def test_backward_compatible_no_transcript(self):
        resp = DebateResultResponse(
            debate_id="deb_abc",
            asset="btc",
            status="completed",
            current_turn=6,
            max_turns=6,
            created_at=datetime.now(timezone.utc),
        )
        dumped = resp.model_dump(by_alias=True)
        assert "debateId" in dumped
        assert dumped["transcript"] is None
