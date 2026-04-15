import pytest
from datetime import datetime, timezone

from app.services.debate.vote_schemas import (
    TranscriptMessage,
    DebateResultResponse,
)


class TestTranscriptMessage:
    @pytest.mark.p1
    def test_valid_message(self):
        """[4.3-001] BDD: Given role and content strings, when creating TranscriptMessage, then fields are stored correctly."""
        msg = TranscriptMessage(role="bull", content="BTC will rise")
        assert msg.role == "bull"
        assert msg.content == "BTC will rise"

    @pytest.mark.p1
    def test_serialization(self):
        """[4.3-002] BDD: Given a TranscriptMessage, when calling model_dump, then produces correct dict with role and content keys."""
        msg = TranscriptMessage(role="bear", content="BTC will fall")
        dumped = msg.model_dump()
        assert dumped["role"] == "bear"
        assert dumped["content"] == "BTC will fall"


class TestDebateResultResponseTranscript:
    @pytest.mark.p0
    def test_transcript_none_default(self):
        """[4.3-003] BDD: Given DebateResultResponse without transcript, when serializing, then transcript defaults to None."""
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
        """[4.3-004] BDD: Given DebateResultResponse with transcript messages, when serializing with by_alias, then transcript array contains correct role/content pairs."""
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
        """[4.3-005] BDD: Given DebateResultResponse with empty transcript list, when serializing, then transcript is an empty array."""
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
        """[4.3-006] BDD: Given DebateResultResponse without transcript field, when serializing with by_alias, then output contains camelCase keys and transcript is None (backward compat)."""
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
