import pytest
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Debate, Vote


class TestDebateModel:
    @pytest.mark.asyncio
    async def test_create_debate(self, db_session: AsyncSession):
        debate = Debate(
            external_id="deb_abc12345",
            asset="bitcoin",
            status="running",
            max_turns=6,
            current_turn=0,
            guardian_interrupts_count=0,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        assert debate.id is not None
        assert debate.external_id == "deb_abc12345"
        assert debate.asset == "bitcoin"
        assert debate.status == "running"
        assert debate.max_turns == 6
        assert debate.current_turn == 0
        assert debate.guardian_verdict is None
        assert debate.guardian_interrupts_count == 0
        assert debate.transcript is None
        assert debate.created_at is not None
        assert debate.completed_at is None

    @pytest.mark.asyncio
    async def test_debate_defaults(self, db_session: AsyncSession):
        debate = Debate(
            external_id="deb_defaults",
            asset="eth",
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        assert debate.status == "running"
        assert debate.max_turns == 6
        assert debate.current_turn == 0
        assert debate.guardian_interrupts_count == 0

    @pytest.mark.asyncio
    async def test_debate_completed_with_verdict(self, db_session: AsyncSession):
        debate = Debate(
            external_id="deb_completed",
            asset="sol",
            status="completed",
            current_turn=6,
            guardian_verdict="Caution",
            guardian_interrupts_count=2,
            transcript='[{"role":"bull","content":"..."}]',
            completed_at=datetime.now(timezone.utc),
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        assert debate.status == "completed"
        assert debate.guardian_verdict == "Caution"
        assert debate.guardian_interrupts_count == 2
        assert debate.completed_at is not None

    @pytest.mark.asyncio
    async def test_debate_external_id_unique(self, db_session: AsyncSession):
        debate1 = Debate(external_id="deb_unique", asset="btc")
        db_session.add(debate1)
        await db_session.commit()

        debate2 = Debate(external_id="deb_unique", asset="eth")
        db_session.add(debate2)
        with pytest.raises(Exception):
            await db_session.commit()


class TestVoteModel:
    @pytest.mark.asyncio
    async def test_create_vote(self, db_session: AsyncSession):
        debate = Debate(
            external_id="deb_vote_test",
            asset="bitcoin",
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        vote = Vote(
            debate_id=debate.id,
            choice="bull",
            voter_fingerprint="fp_abc123",
        )
        db_session.add(vote)
        await db_session.commit()
        await db_session.refresh(vote)

        assert vote.id is not None
        assert vote.debate_id == debate.id
        assert vote.choice == "bull"
        assert vote.voter_fingerprint == "fp_abc123"
        assert vote.created_at is not None

    @pytest.mark.asyncio
    async def test_vote_unique_debate_fingerprint(self, db_session: AsyncSession):
        debate = Debate(external_id="deb_vote_unique", asset="btc")
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        vote1 = Vote(
            debate_id=debate.id,
            choice="bull",
            voter_fingerprint="fp_same",
        )
        db_session.add(vote1)
        await db_session.commit()

        vote2 = Vote(
            debate_id=debate.id,
            choice="bear",
            voter_fingerprint="fp_same",
        )
        db_session.add(vote2)
        with pytest.raises(Exception):
            await db_session.commit()

    @pytest.mark.asyncio
    async def test_same_fingerprint_different_debates(self, db_session: AsyncSession):
        debate1 = Debate(external_id="deb_v1", asset="btc")
        debate2 = Debate(external_id="deb_v2", asset="eth")
        db_session.add_all([debate1, debate2])
        await db_session.commit()
        await db_session.refresh(debate1)
        await db_session.refresh(debate2)

        vote1 = Vote(debate_id=debate1.id, choice="bull", voter_fingerprint="fp_x")
        vote2 = Vote(debate_id=debate2.id, choice="bear", voter_fingerprint="fp_x")
        db_session.add_all([vote1, vote2])
        await db_session.commit()

        result = await db_session.execute(select(func.count()).select_from(Vote))
        count = result.scalar()
        assert count == 2

    @pytest.mark.asyncio
    async def test_debate_votes_relationship(self, db_session: AsyncSession):
        debate = Debate(external_id="deb_rel", asset="sol")
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        for choice in ["bull", "bear", "bull"]:
            vote = Vote(
                debate_id=debate.id,
                choice=choice,
                voter_fingerprint=f"fp_{choice}_{uuid4().hex[:4]}",
            )
            db_session.add(vote)
        await db_session.commit()

        result = await db_session.execute(
            select(func.count()).select_from(Vote).where(Vote.debate_id == debate.id)
        )
        count = result.scalar()
        assert count == 3
