import pytest
from datetime import datetime, timezone

from app.services.debate.vote_schemas import (
    VoteRequest,
    VoteResponse,
    DebateResultResponse,
    StandardVoteResponse,
    StandardDebateResultResponse,
)


class TestVoteRequest:
    @pytest.mark.p1
    def test_valid_bull_vote(self):
        """[3-1-SCHEMA-001] Given valid bull vote, When VoteRequest created, Then choice=bull"""
        req = VoteRequest(
            debate_id="deb_abc123",
            choice="bull",
            voter_fingerprint="fp_123",
        )
        assert req.choice == "bull"
        assert req.debate_id == "deb_abc123"

    @pytest.mark.p1
    def test_valid_bear_vote(self):
        """[3-1-SCHEMA-002] Given valid bear vote, When VoteRequest created, Then choice=bear"""
        req = VoteRequest(
            debate_id="deb_abc123",
            choice="bear",
            voter_fingerprint="fp_456",
        )
        assert req.choice == "bear"

    @pytest.mark.p1
    def test_valid_undecided_vote(self):
        """[3-1-SCHEMA-003] Given valid undecided vote, When VoteRequest created, Then choice=undecided"""
        req = VoteRequest(
            debate_id="deb_abc123",
            choice="undecided",
            voter_fingerprint="fp_789",
        )
        assert req.choice == "undecided"

    @pytest.mark.p0
    def test_choice_normalized(self):
        """[3-1-SCHEMA-004] Given uppercase BULL, When VoteRequest created, Then choice normalized to bull"""
        req = VoteRequest(
            debate_id="deb_abc123",
            choice="BULL",
            voter_fingerprint="fp_123",
        )
        assert req.choice == "bull"

    @pytest.mark.p0
    def test_choice_stripped(self):
        """[3-1-SCHEMA-005] Given '  bull  ', When VoteRequest created, Then choice stripped to bull"""
        req = VoteRequest(
            debate_id="deb_abc123",
            choice="  bull  ",
            voter_fingerprint="fp_123",
        )
        assert req.choice == "bull"

    @pytest.mark.p0
    def test_invalid_choice(self):
        """[3-1-SCHEMA-006] Given invalid choice, When VoteRequest created, Then ValueError"""
        with pytest.raises(ValueError, match="Invalid vote choice"):
            VoteRequest(
                debate_id="deb_abc123",
                choice="maybe",
                voter_fingerprint="fp_123",
            )

    @pytest.mark.p1
    def test_empty_choice(self):
        """[3-1-SCHEMA-007] Given empty choice, When VoteRequest created, Then ValueError"""
        with pytest.raises(ValueError):
            VoteRequest(
                debate_id="deb_abc123",
                choice="",
                voter_fingerprint="fp_123",
            )

    @pytest.mark.p1
    def test_empty_debate_id(self):
        """[3-1-SCHEMA-008] Given empty debate_id, When VoteRequest created, Then ValueError"""
        with pytest.raises(ValueError):
            VoteRequest(
                debate_id="",
                choice="bull",
                voter_fingerprint="fp_123",
            )

    @pytest.mark.p0
    def test_empty_fingerprint(self):
        """[3-1-SCHEMA-009] Given empty fingerprint, When VoteRequest created, Then ValueError"""
        with pytest.raises(ValueError):
            VoteRequest(
                debate_id="deb_abc123",
                choice="bull",
                voter_fingerprint="",
            )

    @pytest.mark.p0
    def test_fingerprint_too_long(self):
        """[3-1-SCHEMA-010] Given 129-char fingerprint, When VoteRequest created, Then ValueError"""
        with pytest.raises(ValueError):
            VoteRequest(
                debate_id="deb_abc123",
                choice="bull",
                voter_fingerprint="x" * 129,
            )

    @pytest.mark.p1
    def test_camel_case_serialization(self):
        """[3-1-SCHEMA-011] Given VoteRequest, When serialized by alias, Then camelCase keys"""
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
    @pytest.mark.p1
    def test_camel_case_serialization(self):
        """[3-1-SCHEMA-012] Given VoteResponse, When serialized by alias, Then camelCase keys"""
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

    @pytest.mark.p1
    def test_auto_timestamp(self):
        """[3-1-SCHEMA-013] Given VoteResponse, When created, Then created_at auto-set"""
        resp = VoteResponse(
            vote_id="vote_abc",
            debate_id="deb_abc123",
            choice="bull",
            voter_fingerprint="fp_123",
        )
        assert resp.created_at is not None
        assert isinstance(resp.created_at, datetime)


class TestDebateResultResponse:
    @pytest.mark.p1
    def test_full_result(self):
        """[3-1-SCHEMA-014] Given full result data, When serialized by alias, Then all camelCase fields correct"""
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

    @pytest.mark.p1
    def test_minimal_result(self):
        """[3-1-SCHEMA-015] Given minimal result, When serialized, Then optional fields are None/default"""
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
    @pytest.mark.p1
    def test_success_envelope(self):
        """[3-1-SCHEMA-016] Given success VoteResponse, When wrapped in envelope, Then data present error null"""
        vote_resp = VoteResponse(
            vote_id="vote_abc",
            debate_id="deb_abc123",
            choice="bull",
            voter_fingerprint="fp_123",
        )
        envelope = StandardVoteResponse(data=vote_resp, error=None, meta={})
        assert envelope.data is not None
        assert envelope.error is None

    @pytest.mark.p1
    def test_error_envelope(self):
        """[3-1-SCHEMA-017] Given error dict, When wrapped in envelope, Then data null error present"""
        envelope = StandardVoteResponse(
            data=None,
            error={"code": "DUPLICATE_VOTE", "message": "Already voted"},
            meta={},
        )
        assert envelope.data is None
        assert envelope.error is not None
        assert envelope.error["code"] == "DUPLICATE_VOTE"


class TestStandardDebateResultResponse:
    @pytest.mark.p1
    def test_success_envelope(self):
        """[3-1-SCHEMA-018] Given result, When wrapped in envelope, Then data present"""
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
