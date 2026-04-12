import asyncio
import logging
import time

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import Debate, Vote
from app.services.debate.repository import DebateRepository
from app.services.debate.vote_schemas import DebateResultResponse

logger = logging.getLogger(__name__)


@pytest.fixture
async def debate_with_1000_votes(db_session: AsyncSession):
    from uuid import uuid4

    debate = Debate(
        external_id=f"deb_bench_{uuid4().hex[:8]}",
        asset="bitcoin",
        status="running",
        max_turns=6,
        current_turn=0,
    )
    db_session.add(debate)
    await db_session.commit()
    await db_session.refresh(debate)

    votes = []
    for i in range(450):
        votes.append(
            Vote(
                debate_id=debate.id,
                choice="bull",
                voter_fingerprint=f"fp_bench_bull_{i}",
            )
        )
    for i in range(350):
        votes.append(
            Vote(
                debate_id=debate.id,
                choice="bear",
                voter_fingerprint=f"fp_bench_bear_{i}",
            )
        )
    for i in range(200):
        votes.append(
            Vote(
                debate_id=debate.id,
                choice="undecided",
                voter_fingerprint=f"fp_bench_und_{i}",
            )
        )

    db_session.add_all(votes)
    await db_session.commit()
    return debate


class TestSentimentBenchmark:
    @pytest.mark.asyncio
    async def test_concurrent_reads_200(self, engine, debate_with_1000_votes):
        """[3-3-BENCH-001] 200 concurrent get_result() reads on 1000-vote debate"""
        external_id = debate_with_1000_votes.external_id
        session_factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )

        async def single_read():
            async with session_factory() as session:
                repo = DebateRepository(session)
                start = time.monotonic()
                result = await repo.get_result(external_id)
                elapsed_ms = (time.monotonic() - start) * 1000
                return result, elapsed_ms

        results = await asyncio.gather(*[single_read() for _ in range(200)])

        latencies = []
        for result, elapsed_ms in results:
            assert isinstance(result, DebateResultResponse)
            assert result.total_votes >= 0
            assert all(count >= 0 for count in result.vote_breakdown.values())
            latencies.append(elapsed_ms)

        latencies.sort()
        p99 = latencies[int(len(latencies) * 0.99)]

        total_votes_values = {r.total_votes for r, _ in results}
        assert len(total_votes_values) == 1, (
            f"Inconsistent totalVotes across concurrent reads: {total_votes_values}"
        )
        assert total_votes_values == {1000}

        first_result = results[0][0]
        assert first_result.vote_breakdown == {
            "bull": 450,
            "bear": 350,
            "undecided": 200,
        }

        if p99 > 200:
            logger.warning(
                "BENCHMARK: p99 latency %.1fms exceeds 200ms target "
                "(not CI-gated, performance regression detector)",
                p99,
            )
        if p99 > 1000:
            pytest.fail(f"p99 latency {p99:.1f}ms exceeds 1000ms hard limit")

        logger.info(
            "BENCHMARK: p50=%.1fms p99=%.1fms min=%.1fms max=%.1fms",
            latencies[int(len(latencies) * 0.50)],
            p99,
            latencies[0],
            latencies[-1],
        )
