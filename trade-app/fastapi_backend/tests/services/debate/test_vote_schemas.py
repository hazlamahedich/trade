import pytest
from datetime import datetime, timezone

from app.services.debate.vote_schemas import (
    VoteRequest,
    VoteResponse,
    DebateResultResponse,
    StandardVoteResponse,
    StandardDebateResultResponse,
    VALID_VOTE_CHOICES,
)


class TestVoteRequest:
    def test_valid_bull_vote(self):
        req = VoteRequest(
            debate_id="deb_abc123",
            choice="bull",
            voter_fingerprint="fp_123",
        )
        assert req.choice == "bull"
        assert req.debate_id == "deb_abc123"

    def test_valid_bear_vote(self):
        req = VoteRequest(
            debate_id="deb_abc123",
            choice="bear",
            voter_fingerprint="fp_456",
        )
        assert req.choice == "bear"

    def test_valid_undecided_vote(self):
        req = VoteRequest(
            debate_id="deb_abc123",
            choice="undecided",
            voter_fingerprint="fp_789",
        )
        assert req.choice == "undecided"

    def test_choice_normalized(self):
        req = VoteRequest(
            debate_id="deb_abc123",
            choice="BULL",
            voter_fingerprint="fp_123",
        )
        assert req.choice == "bull"

    def test_choice_stripped(self):
        req = VoteRequest(
            debate_id="deb_abc123",
            choice="  bull  ",
            voter_fingerprint="fp_123",
        )
        assert req.choice == "bull"

    def test_invalid_choice(self):
        with pytest.raises(ValueError, match="Invalid vote choice"):
            VoteRequest(
                debate_id="deb_abc123",
                choice="maybe",
                voter_fingerprint="fp_123",
            )

    def test_empty_choice(self):
        with pytest.raises(ValueError):
            VoteRequest(
                debate_id="deb_abc123",
                choice="",
                voter_fingerprint="fp_123",
            )

    def test_empty_debate_id(self):
        with pytest.raises(ValueError):
            VoteRequest(
                debate_id="",
                choice="bull",
                voter_fingerprint="fp_123",
            )

    def test_empty_fingerprint(self):
        with pytest.raises(ValueError):
            VoteRequest(
                debate_id="deb_abc123",
                choice="bull",
                voter_fingerprint="",
            )

    def test_fingerprint_too_long(self):
        with pytest.raises(ValueError):
            VoteRequest(
                debate_id="deb_abc123",
                choice="bull",
                voter_fingerprint="x" * 129,
            )

    def test_camel_case_serialization(self):
        req = VoteRequest(
            debate_id="deb_abc123",
            choice="bull",
            voter_fingerprint="fp_123",
        )
        dumped = req.model_dump(by_alias=True)
        assert "debateId" in dumped
        assert "voterFingerprint" in dumped
        assert "debate_id" not in dumped


class TestVoteResponse:
    def test_camel_case_serialization(self):
        resp = VoteResponse(
            vote_id="vote_abc",
            debate_id="deb_abc123",
            choice="bull",
            voter_fingerprint="fp_123",
        )
        dumped = resp.model_dump(by_alias=True)
        assert "voteId" in dumped
        assert "debateId" in dumped
        assert "voterFingerprint" in dumped
        assert "createdAt" in dumped

    def test_auto_timestamp(self):
        resp = VoteResponse(
            vote_id="vote_abc",
            debate_id="deb_abc123",
            choice="bull",
            voter_fingerprint="fp_123",
        )
        assert resp.created_at is not None
        assert isinstance(resp.created_at, datetime)


class TestDebateResultResponse:
    def test_full_result(self):
        resp = DebateResultResponse(
            debate_id="deb_abc123",
            asset="bitcoin",
            status="completed",
            current_turn=6,
            max_turns=6,
            guardian_verdict="Caution",
            guardian_interrupts_count=2,
            created_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
            total_votes=10,
            vote_breakdown={"bull": 6, "bear": 3, "undecided": 1},
        )
        dumped = resp.model_dump(by_alias=True)
        assert dumped["debateId"] == "deb_abc123"
        assert dumped["guardianVerdict"] == "Caution"
        assert dumped["guardianInterruptsCount"] == 2
        assert dumped["totalVotes"] == 10
        assert dumped["voteBreakdown"]["bull"] == 6

    def test_minimal_result(self):
        resp = DebateResultResponse(
            debate_id="deb_abc123",
            asset="eth",
            status="running",
            current_turn=3,
            max_turns=6,
            created_at=datetime.now(timezone.utc),
        )
        dumped = resp.model_dump(by_alias=True)
        assert dumped["guardianVerdict"] is None
        assert dumped["completedAt"] is None
        assert dumped["totalVotes"] == 0
        assert dumped["voteBreakdown"] == {}


class TestStandardVoteResponse:
    def test_success_envelope(self):
        vote_resp = VoteResponse(
            vote_id="vote_abc",
            debate_id="deb_abc123",
            choice="bull",
            voter_fingerprint="fp_123",
        )
        envelope = StandardVoteResponse(data=vote_resp, error=None, meta={})
        assert envelope.data is not None
        assert envelope.error is None

    def test_error_envelope(self):
        envelope = StandardVoteResponse(
            data=None,
            error={"code": "DUPLICATE_VOTE", "message": "Already voted"},
            meta={},
        )
        assert envelope.data is None
        assert envelope.error is not None
        assert envelope.error["code"] == "DUPLICATE_VOTE"


class TestStandardDebateResultResponse:
    def test_success_envelope(self):
        result = DebateResultResponse(
            debate_id="deb_abc123",
            asset="bitcoin",
            status="completed",
            current_turn=6,
            max_turns=6,
            created_at=datetime.now(timezone.utc),
        )
        envelope = StandardDebateResultResponse(data=result, error=None, meta={})
        assert envelope.data is not None
        assert envelope.data.asset == "bitcoin"
