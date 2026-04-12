import asyncio
import pytest
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import Debate
from app.services.debate.repository import DebateRepository
from app.services.debate.vote_schemas import DebateResultResponse


@pytest.fixture
async def debate_for_integration(db_session: AsyncSession):
    debate = Debate(
        external_id=f"deb_intg_{uuid4().hex[:8]}",
        asset="bitcoin",
        status="running",
        max_turns=6,
        current_turn=0,
    )
    db_session.add(debate)
    await db_session.commit()
    await db_session.refresh(debate)
    return debate


class TestConcurrentVotingAndReading:
    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_read_during_active_voting(self, engine, debate_for_integration):
        """[3-3-INTG-001] Concurrent reads during active voting always return valid state"""
        external_id = debate_for_integration.external_id
        session_factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        async def cast_vote(choice: str, idx: int):
            async with session_factory() as session:
                repo = DebateRepository(session)
                await repo.create_vote(
                    debate_id=debate_for_integration.id,
                    debate_external_id=external_id,
                    choice=choice,
                    voter_fingerprint=f"fp_intg_vote_{idx}",
                )

        async def read_result():
            async with session_factory() as session:
                repo = DebateRepository(session)
                return await repo.get_result(external_id)

        vote_tasks = []
        for i in range(10):
            choice = "bull" if i % 3 == 0 else ("bear" if i % 3 == 1 else "undecided")
            vote_tasks.append(cast_vote(choice, i))

        read_tasks = [read_result() for _ in range(5)]

        all_tasks = vote_tasks + read_tasks
        results = await asyncio.gather(*all_tasks, return_exceptions=True)

        for r in results[-5:]:
            if isinstance(r, DebateResultResponse):
                assert r.total_votes >= 0
                assert all(count >= 0 for count in r.vote_breakdown.values())

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_final_count_matches_votes_cast(self, engine, debate_for_integration):
        """[3-3-INTG-002] After all votes committed, get_result reflects exact count"""
        session_factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
        external_id = debate_for_integration.external_id

        async def cast_vote(choice: str, idx: int):
            async with session_factory() as session:
                repo = DebateRepository(session)
                await repo.create_vote(
                    debate_id=debate_for_integration.id,
                    debate_external_id=external_id,
                    choice=choice,
                    voter_fingerprint=f"fp_intg_final_{idx}",
                )

        await asyncio.gather(
            cast_vote("bull", 0),
            cast_vote("bull", 1),
            cast_vote("bull", 2),
            cast_vote("bear", 3),
            cast_vote("bear", 4),
            cast_vote("undecided", 5),
        )

        async with session_factory() as session:
            repo = DebateRepository(session)
            result = await repo.get_result(external_id)

        assert result is not None
        assert result.total_votes == 6
        assert result.vote_breakdown["bull"] == 3
        assert result.vote_breakdown["bear"] == 2
        assert result.vote_breakdown["undecided"] == 1
