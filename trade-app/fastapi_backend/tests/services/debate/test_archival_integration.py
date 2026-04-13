import json
from unittest.mock import AsyncMock, patch

import pytest

from app.models import Debate, Vote
from app.services.debate.archival import archive_debate
from app.services.debate.repository import DebateRepository
from sqlalchemy import select


class TestArchivalIntegration:
    """[4-1-INT] Integration tests using real PostgreSQL."""

    @pytest.mark.asyncio
    async def test_archive_persists_to_real_postgres(self, db_session):
        debate = Debate(
            external_id="deb_archive_int",
            asset="bitcoin",
            status="running",
            max_turns=6,
            current_turn=4,
            guardian_interrupts_count=1,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        vote1 = Vote(debate_id=debate.id, choice="bull", voter_fingerprint="fp_1")
        vote2 = Vote(debate_id=debate.id, choice="bull", voter_fingerprint="fp_2")
        vote3 = Vote(debate_id=debate.id, choice="bear", voter_fingerprint="fp_3")
        db_session.add_all([vote1, vote2, vote3])
        await db_session.commit()

        state = {
            "messages": [
                {"role": "bull", "content": "Bull case"},
                {"role": "bear", "content": "Bear case"},
            ],
            "guardian_verdict": "Caution",
            "guardian_interrupts": [{"turn": 2, "reason": "test"}],
            "current_turn": 4,
        }

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=db_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch("app.services.debate.archival.stream_state") as mock_ss:
                mock_ss.delete_state = AsyncMock()
                await archive_debate("deb_archive_int", state)

        stmt = select(Debate).where(Debate.external_id == "deb_archive_int")
        result = await db_session.execute(stmt)
        refreshed = result.scalar_one()

        assert refreshed.status == "completed"
        assert refreshed.completed_at is not None
        assert refreshed.guardian_verdict == "Caution"
        assert refreshed.guardian_interrupts_count == 1
        assert refreshed.current_turn == 4
        assert refreshed.vote_bull == 2
        assert refreshed.vote_bear == 1
        assert refreshed.vote_undecided == 0
        transcript = json.loads(refreshed.transcript)
        assert len(transcript) == 2
        assert transcript[0]["role"] == "bull"

    @pytest.mark.asyncio
    async def test_archive_transcript_is_valid_json(self, db_session):
        debate = Debate(
            external_id="deb_json_roundtrip",
            asset="ethereum",
            status="running",
            max_turns=6,
            current_turn=2,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        messages = [
            {"role": "bull", "content": "ETH to the moon!"},
            {"role": "bear", "content": "ETH is overvalued."},
            {"role": "guardian", "content": "Caution advised.", "risk_level": "medium"},
        ]
        state = {
            "messages": messages,
            "current_turn": 2,
        }

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=db_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch("app.services.debate.archival.stream_state") as mock_ss:
                mock_ss.delete_state = AsyncMock()
                await archive_debate("deb_json_roundtrip", state)

        stmt = select(Debate).where(Debate.external_id == "deb_json_roundtrip")
        result = await db_session.execute(stmt)
        refreshed = result.scalar_one()

        round_tripped = json.loads(refreshed.transcript)
        assert round_tripped == messages
        roles = [m["role"] for m in round_tripped]
        assert "bull" in roles
        assert "bear" in roles
        assert "guardian" in roles


class TestRepositoryVoteColumnGuards:
    """[4-1-UNIT] Verify complete_debate vote column guards from review finding."""

    @pytest.mark.asyncio
    async def test_complete_debate_sets_vote_columns(self, db_session):
        debate = Debate(
            external_id="deb_vote_guard",
            asset="bitcoin",
            status="running",
            max_turns=6,
            current_turn=4,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        repo = DebateRepository(db_session)
        result = await repo.complete_debate(
            external_id="deb_vote_guard",
            guardian_verdict="Caution",
            guardian_interrupts_count=2,
            transcript='[{"role":"bull","content":"test"}]',
            current_turn=4,
            vote_bull=10,
            vote_bear=5,
            vote_undecided=3,
        )

        assert result is not None
        assert result.vote_bull == 10
        assert result.vote_bear == 5
        assert result.vote_undecided == 3

    @pytest.mark.asyncio
    async def test_complete_debate_does_not_overwrite_with_none(self, db_session):
        debate = Debate(
            external_id="deb_vote_none",
            asset="bitcoin",
            status="running",
            max_turns=6,
            current_turn=4,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        repo = DebateRepository(db_session)
        await repo.complete_debate(
            external_id="deb_vote_none",
            vote_bull=10,
            vote_bear=5,
            vote_undecided=3,
        )

        debate_after = await repo.get_by_external_id("deb_vote_none")
        original_bull = debate_after.vote_bull

        await repo.complete_debate(
            external_id="deb_vote_none",
            vote_bull=None,
            vote_bear=None,
            vote_undecided=None,
        )

        debate_final = await repo.get_by_external_id("deb_vote_none")
        assert debate_final.vote_bull == original_bull


class TestArchivalExtendedIntegration:
    """[4-1-INT] Extended integration: idempotency, full flow, model columns."""

    @pytest.mark.asyncio
    async def test_idempotency_under_real_postgres(self, db_session):
        debate = Debate(
            external_id="deb_idempotent",
            asset="bitcoin",
            status="running",
            max_turns=6,
            current_turn=2,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        state = {
            "messages": [{"role": "bull", "content": "Bull"}],
            "current_turn": 2,
        }

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=db_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch("app.services.debate.archival.stream_state") as mock_ss:
                mock_ss.delete_state = AsyncMock()
                await archive_debate("deb_idempotent", state)

        stmt = select(Debate).where(Debate.external_id == "deb_idempotent")
        result = await db_session.execute(stmt)
        refreshed = result.scalar_one()
        assert refreshed.status == "completed"
        first_completed_at = refreshed.completed_at

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=db_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch("app.services.debate.archival.stream_state") as mock_ss:
                mock_ss.delete_state = AsyncMock()
                await archive_debate("deb_idempotent", state)

        result2 = await db_session.execute(stmt)
        refreshed2 = result2.scalar_one()
        assert refreshed2.completed_at == first_completed_at

    @pytest.mark.asyncio
    async def test_debate_model_has_vote_columns(self, db_session):
        debate = Debate(
            external_id="deb_model_cols",
            asset="ethereum",
            status="running",
            max_turns=6,
            current_turn=0,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        assert hasattr(debate, "vote_bull")
        assert hasattr(debate, "vote_bear")
        assert hasattr(debate, "vote_undecided")
        assert debate.vote_bull is None
        assert debate.vote_bear is None
        assert debate.vote_undecided is None

    @pytest.mark.asyncio
    async def test_full_archival_flow_with_votes(self, db_session):
        debate = Debate(
            external_id="deb_full_flow",
            asset="bitcoin",
            status="running",
            max_turns=6,
            current_turn=6,
            guardian_interrupts_count=1,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        for i, choice in enumerate(
            ["bull", "bull", "bull", "bear", "bear", "undecided"]
        ):
            vote = Vote(
                debate_id=debate.id,
                choice=choice,
                voter_fingerprint=f"fp_full_{i}",
            )
            db_session.add(vote)
        await db_session.commit()

        state = {
            "messages": [{"role": "bull", "content": f"Bull arg {i}"} for i in range(3)]
            + [{"role": "bear", "content": f"Bear arg {i}"} for i in range(3)],
            "guardian_verdict": "High Risk / Wait",
            "guardian_interrupts": [{"turn": 2, "reason": "test interrupt"}],
            "current_turn": 6,
        }

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=db_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch("app.services.debate.archival.stream_state") as mock_ss:
                mock_ss.delete_state = AsyncMock()
                await archive_debate("deb_full_flow", state)

        stmt = select(Debate).where(Debate.external_id == "deb_full_flow")
        result = await db_session.execute(stmt)
        refreshed = result.scalar_one()

        assert refreshed.status == "completed"
        assert refreshed.completed_at is not None
        assert refreshed.guardian_verdict == "High Risk / Wait"
        assert refreshed.guardian_interrupts_count == 1
        assert refreshed.current_turn == 6
        assert refreshed.vote_bull == 3
        assert refreshed.vote_bear == 2
        assert refreshed.vote_undecided == 1

        transcript = json.loads(refreshed.transcript)
        assert len(transcript) == 6
        roles = [m["role"] for m in transcript]
        assert roles.count("bull") == 3
        assert roles.count("bear") == 3
