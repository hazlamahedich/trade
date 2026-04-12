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
    @pytest.mark.p2
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

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_http_result_endpoint_1000_votes(
        self, engine, test_client, debate_with_1000_votes
    ):
        """[BENCH-002] Given 1000 votes, When GET /api/debate/{id}/result called, Then returns 200 with valid envelope and correct data"""
        external_id = debate_with_1000_votes.external_id

        latencies = []
        for _ in range(5):
            start = time.monotonic()
            resp = await test_client.get(f"/api/debate/{external_id}/result")
            elapsed_ms = (time.monotonic() - start) * 1000

            assert resp.status_code == 200
            body = resp.json()
            assert body["data"]["totalVotes"] == 1000
            assert body["data"]["voteBreakdown"] == {
                "bull": 450,
                "bear": 350,
                "undecided": 200,
            }
            assert body["error"] is None
            assert "latencyMs" in body["meta"]
            latencies.append(elapsed_ms)

        latencies.sort()
        p99 = latencies[-1]

        if p99 > 200:
            logger.warning("BENCH-002: HTTP p99 %.1fms exceeds 200ms target", p99)
        if p99 > 1000:
            pytest.fail(f"HTTP p99 {p99:.1f}ms exceeds 1000ms hard limit")

        logger.info(
            "BENCH-002: HTTP p50=%.1fms p99=%.1fms",
            latencies[len(latencies) // 2],
            p99,
        )

    @pytest.mark.p3
    @pytest.mark.asyncio
    @pytest.mark.parametrize("vote_count", [0, 1])
    async def test_sparse_votes_get_result(self, engine, db_session, vote_count):
        """[BENCH-003] Given a debate with 0 or 1 votes, When get_result() called, Then returns valid result with correct count"""
        from uuid import uuid4

        debate = Debate(
            external_id=f"deb_sparse_{uuid4().hex[:8]}",
            asset="bitcoin",
            status="running",
            max_turns=6,
            current_turn=0,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        for i in range(vote_count):
            vote = Vote(
                debate_id=debate.id,
                choice="bull",
                voter_fingerprint=f"fp_sparse_{i}",
            )
            db_session.add(vote)
        await db_session.commit()

        session_factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
        async with session_factory() as session:
            repo = DebateRepository(session)
            start = time.monotonic()
            result = await repo.get_result(debate.external_id)
            elapsed_ms = (time.monotonic() - start) * 1000

        assert result is not None
        assert result.total_votes == vote_count
        if vote_count == 0:
            assert result.vote_breakdown == {}
        else:
            assert result.vote_breakdown == {"bull": 1}

        if elapsed_ms > 200:
            logger.warning(
                "BENCH-003: %d-vote query took %.1fms", vote_count, elapsed_ms
            )
