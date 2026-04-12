import pytest
from pydantic import ValidationError

from app.services.debate.ws_schemas import VoteUpdatePayload


def test_valid_payload_with_bull_bear():
    payload = VoteUpdatePayload(
        debate_id="deb_123",
        total_votes=10,
        vote_breakdown={"bull": 7, "bear": 3},
    )
    dumped = payload.model_dump(by_alias=True)
    assert dumped["debateId"] == "deb_123"
    assert dumped["totalVotes"] == 10
    assert dumped["voteBreakdown"] == {"bull": 7, "bear": 3}


def test_valid_payload_with_undecided():
    payload = VoteUpdatePayload(
        debate_id="deb_456",
        total_votes=20,
        vote_breakdown={"bull": 8, "bear": 6, "undecided": 6},
    )
    dumped = payload.model_dump(by_alias=True)
    assert dumped["voteBreakdown"]["undecided"] == 6


def test_serialization_uses_camel_case_aliases():
    payload = VoteUpdatePayload(
        debate_id="deb_789",
        total_votes=5,
        vote_breakdown={"bull": 5, "bear": 0},
    )
    dumped = payload.model_dump(by_alias=True)
    assert "debateId" in dumped
    assert "totalVotes" in dumped
    assert "voteBreakdown" in dumped
    assert "debate_id" not in dumped
    assert "total_votes" not in dumped
    assert "vote_breakdown" not in dumped


def test_missing_required_field_raises():
    with pytest.raises(ValidationError):
        VoteUpdatePayload(
            debate_id="deb_000",
            total_votes=5,
        )


def test_zero_total_votes():
    payload = VoteUpdatePayload(
        debate_id="deb_empty",
        total_votes=0,
        vote_breakdown={"bull": 0, "bear": 0},
    )
    assert payload.total_votes == 0
    dumped = payload.model_dump(by_alias=True)
    assert dumped["totalVotes"] == 0


def test_empty_breakdown():
    payload = VoteUpdatePayload(
        debate_id="deb_no_votes",
        total_votes=0,
        vote_breakdown={},
    )
    assert payload.vote_breakdown == {}


def test_total_votes_must_be_int():
    with pytest.raises(ValidationError):
        VoteUpdatePayload(
            debate_id="deb_abc",
            total_votes="not_an_int",
            vote_breakdown={"bull": 1},
        )


def test_debate_id_must_be_string():
    with pytest.raises(ValidationError):
        VoteUpdatePayload(
            debate_id=12345,
            total_votes=1,
            vote_breakdown={"bull": 1},
        )
