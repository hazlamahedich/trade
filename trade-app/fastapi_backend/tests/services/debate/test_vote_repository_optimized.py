import asyncio

import pytest
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import Debate
from app.services.debate.repository import DebateRepository

from tests.services.debate.conftest import create_votes


@pytest.fixture
async def debate_opt(db_session: AsyncSession):
    debate = Debate(
        external_id=f"deb_opt_{uuid4().hex[:8]}",
        asset="bitcoin",
        status="running",
        max_turns=6,
        current_turn=0,
    )
    db_session.add(debate)
    await db_session.commit()
    await db_session.refresh(debate)
    return debate


@pytest.fixture
def repo(db_session: AsyncSession):
    return DebateRepository(db_session)


class TestGetResultOptimized:
    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_total_votes_derived_from_breakdown(self, repo, debate_opt):
        """[3-3-REPO-001] totalVotes equals sum(breakdown.values()), not a separate COUNT query"""
        await create_votes(
            repo,
            debate_opt.id,
            debate_opt.external_id,
            ["bull"] * 5 + ["bear"] * 3,
            prefix="fp_opt_derived",
        )

        result = await repo.get_result(debate_opt.external_id)
        assert result is not None
        assert result.total_votes == sum(result.vote_breakdown.values())
        assert result.total_votes == 8
        assert result.vote_breakdown == {"bull": 5, "bear": 3}

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_no_redundant_count_query(self, repo, debate_opt):
        """[3-3-REPO-002] get_result() does NOT execute a separate COUNT query"""
        await repo.create_vote(
            debate_id=debate_opt.id,
            debate_external_id=debate_opt.external_id,
            choice="bull",
            voter_fingerprint="fp_no_count",
        )

        original_execute = repo.session.execute
        execute_calls = []

        async def tracking_execute(stmt, *args, **kwargs):
            stmt_str = str(stmt)
            execute_calls.append(stmt_str)
            return await original_execute(stmt, *args, **kwargs)

        repo.session.execute = tracking_execute

        result = await repo.get_result(debate_opt.external_id)
        assert result is not None

        # NOTE: Detection uses "count(votes.id" substring match, specific to
        # SQLAlchemy 2.x query generation. If ORM upgrade changes the generated
        # SQL, update this string check accordingly. Test fails loudly if broken.
        count_queries = [
            c
            for c in execute_calls
            if "count(votes.id" in c.lower() and "group by" not in c.lower()
        ]
        assert len(count_queries) == 0, (
            f"Found {len(count_queries)} redundant COUNT queries: {count_queries}"
        )

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_single_vote_breakdown(self, repo, debate_opt):
        """[3-3-REPO-003] Single vote returns breakdown with one entry and totalVotes=1"""
        await repo.create_vote(
            debate_id=debate_opt.id,
            debate_external_id=debate_opt.external_id,
            choice="bear",
            voter_fingerprint="fp_single_vote",
        )

        result = await repo.get_result(debate_opt.external_id)
        assert result is not None
        assert result.total_votes == 1
        assert len(result.vote_breakdown) == 1
        assert result.vote_breakdown["bear"] == 1

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_undecided_only_breakdown(self, repo, debate_opt):
        """[3-3-REPO-004] Only undecided votes returns correct breakdown"""
        await create_votes(
            repo,
            debate_opt.id,
            debate_opt.external_id,
            ["undecided"] * 4,
            prefix="fp_undecided",
        )

        result = await repo.get_result(debate_opt.external_id)
        assert result is not None
        assert result.total_votes == 4
        assert result.vote_breakdown == {"undecided": 4}

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_all_three_choices_breakdown(self, repo, debate_opt):
        """[3-3-REPO-005] All 3 vote choices produce correct per-choice counts"""
        await create_votes(
            repo,
            debate_opt.id,
            debate_opt.external_id,
            ["bull"] * 3 + ["bear"] * 2 + ["undecided"],
            prefix="fp_all3",
        )

        result = await repo.get_result(debate_opt.external_id)
        assert result is not None
        assert result.total_votes == 6
        assert result.vote_breakdown == {"bull": 3, "bear": 2, "undecided": 1}

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_debate_metadata_in_result(self, repo, debate_opt):
        """[3-3-REPO-006] get_result returns correct debate metadata fields"""
        result = await repo.get_result(debate_opt.external_id)
        assert result is not None
        assert result.debate_id == debate_opt.external_id
        assert result.asset == "bitcoin"
        assert result.status == "running"
        assert result.current_turn == 0
        assert result.max_turns == 6
        assert result.guardian_verdict is None
        assert result.guardian_interrupts_count == 0
        assert result.created_at is not None
        assert result.completed_at is None

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_exact_query_count(self, repo, debate_opt):
        """[3-3-REPO-007] get_result executes exactly 2 queries (debate lookup + GROUP BY)"""
        await repo.create_vote(
            debate_id=debate_opt.id,
            debate_external_id=debate_opt.external_id,
            choice="bull",
            voter_fingerprint="fp_exact_qc",
        )

        original_execute = repo.session.execute
        execute_calls = []

        async def tracking_execute(stmt, *args, **kwargs):
            execute_calls.append(stmt)
            return await original_execute(stmt, *args, **kwargs)

        repo.session.execute = tracking_execute

        result = await repo.get_result(debate_opt.external_id)
        assert result is not None
        assert len(execute_calls) == 2, (
            f"Expected exactly 2 queries, got {len(execute_calls)}"
        )

    @pytest.mark.p2
    @pytest.mark.asyncio
    async def test_get_result_idempotent(self, repo, debate_opt):
        """[3-3-REPO-008] Repeated get_result calls return identical results"""
        await create_votes(
            repo,
            debate_opt.id,
            debate_opt.external_id,
            ["bull", "bear"],
            prefix="fp_idempotent",
        )

        result1 = await repo.get_result(debate_opt.external_id)
        result2 = await repo.get_result(debate_opt.external_id)

        assert result1.total_votes == result2.total_votes == 2
        assert (
            result1.vote_breakdown == result2.vote_breakdown == {"bull": 1, "bear": 1}
        )

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_get_result_completed_debate(self, repo, debate_opt):
        """[3-3-REPO-009] get_result returns correct status for completed debate"""
        await repo.complete_debate(
            external_id=debate_opt.external_id,
            guardian_verdict="High Risk",
            guardian_interrupts_count=1,
        )
        await repo.create_vote(
            debate_id=debate_opt.id,
            debate_external_id=debate_opt.external_id,
            choice="bear",
            voter_fingerprint="fp_completed_vote",
        )

        result = await repo.get_result(debate_opt.external_id)
        assert result is not None
        assert result.status == "completed"
        assert result.guardian_verdict == "High Risk"
        assert result.guardian_interrupts_count == 1
        assert result.completed_at is not None
        assert result.total_votes == 1
        assert result.vote_breakdown == {"bear": 1}


class TestSentimentResultSerialization:
    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_result_response_all_camel_case_aliases(self, repo, debate_opt):
        """[3-3-REPO-010] DebateResultResponse serializes all fields with camelCase aliases"""
        await repo.create_vote(
            debate_id=debate_opt.id,
            debate_external_id=debate_opt.external_id,
            choice="bull",
            voter_fingerprint="fp_serialization",
        )

        result = await repo.get_result(debate_opt.external_id)
        dumped = result.model_dump(by_alias=True)

        expected_keys = {
            "debateId",
            "asset",
            "status",
            "currentTurn",
            "maxTurns",
            "guardianVerdict",
            "guardianInterruptsCount",
            "createdAt",
            "completedAt",
            "totalVotes",
            "voteBreakdown",
        }
        assert set(dumped.keys()) == expected_keys

    @pytest.mark.p2
    @pytest.mark.asyncio
    async def test_result_model_dump_no_alias_uses_snake_case(self, repo, debate_opt):
        """[3-3-REPO-011] Without by_alias, model_dump returns snake_case field names"""
        await repo.create_vote(
            debate_id=debate_opt.id,
            debate_external_id=debate_opt.external_id,
            choice="bear",
            voter_fingerprint="fp_no_alias",
        )

        result = await repo.get_result(debate_opt.external_id)
        dumped = result.model_dump()

        assert "debate_id" in dumped
        assert "total_votes" in dumped
        assert "vote_breakdown" in dumped
        assert "guardian_verdict" in dumped
        assert "guardian_interrupts_count" in dumped


class TestConcurrentWriteIdempotency:
    @pytest.mark.p2
    @pytest.mark.asyncio
    async def test_count_deterministic_after_concurrent_votes(self, engine, debate_opt):
        """[REPO-012] Given a debate with 0 votes, When 10 concurrent vote submissions fire, Then the resulting vote count is exactly 10"""
        session_factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
        external_id = debate_opt.external_id
        choices = ["bull", "bear", "undecided"]

        async def cast_vote(idx: int):
            async with session_factory() as session:
                repo = DebateRepository(session)
                await repo.create_vote(
                    debate_id=debate_opt.id,
                    debate_external_id=external_id,
                    choice=choices[idx % 3],
                    voter_fingerprint=f"fp_conc_write_{idx}",
                )

        await asyncio.gather(*[cast_vote(i) for i in range(10)])

        async with session_factory() as session:
            repo = DebateRepository(session)
            result = await repo.get_result(external_id)

        assert result is not None
        assert result.total_votes == 10
        assert sum(result.vote_breakdown.values()) == 10
