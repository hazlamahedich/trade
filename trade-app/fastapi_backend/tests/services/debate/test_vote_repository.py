import pytest
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Debate, Vote
from app.services.debate.repository import DebateRepository
from app.services.debate.vote_schemas import VoteResponse, DebateResultResponse


@pytest.fixture
async def debate_with_session(db_session: AsyncSession):
    debate = Debate(
        external_id=f"deb_repo_{uuid4().hex[:8]}",
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


class TestGetByExternalId:
    @pytest.mark.asyncio
    async def test_found(self, repo, debate_with_session):
        result = await repo.get_by_external_id(debate_with_session.external_id)
        assert result is not None
        assert result.id == debate_with_session.id
        assert result.asset == "bitcoin"

    @pytest.mark.asyncio
    async def test_not_found(self, repo):
        result = await repo.get_by_external_id("deb_nonexistent")
        assert result is None


class TestSaveDebate:
    @pytest.mark.asyncio
    async def test_save_minimal(self, repo, db_session):
        debate = await repo.save_debate(
            external_id=f"deb_save_{uuid4().hex[:8]}",
            asset="eth",
            status="running",
            current_turn=0,
            max_turns=6,
        )
        assert debate.id is not None
        assert debate.asset == "eth"
        assert debate.status == "running"
        assert debate.guardian_verdict is None
        assert debate.guardian_interrupts_count == 0

    @pytest.mark.asyncio
    async def test_save_with_guardian_fields(self, repo):
        debate = await repo.save_debate(
            external_id=f"deb_guard_{uuid4().hex[:8]}",
            asset="sol",
            status="running",
            current_turn=3,
            max_turns=6,
            guardian_verdict="Caution",
            guardian_interrupts_count=2,
            transcript='[{"role":"bull"}]',
        )
        assert debate.guardian_verdict == "Caution"
        assert debate.guardian_interrupts_count == 2
        assert debate.transcript == '[{"role":"bull"}]'


class TestCompleteDebate:
    @pytest.mark.asyncio
    async def test_complete(self, repo, debate_with_session):
        completed = await repo.complete_debate(
            external_id=debate_with_session.external_id,
            guardian_verdict="High Risk",
            guardian_interrupts_count=3,
            transcript="[]",
            current_turn=4,
        )
        assert completed is not None
        assert completed.status == "completed"
        assert completed.completed_at is not None
        assert completed.guardian_verdict == "High Risk"
        assert completed.guardian_interrupts_count == 3

    @pytest.mark.asyncio
    async def test_complete_not_found(self, repo):
        result = await repo.complete_debate(external_id="deb_missing")
        assert result is None


class TestCreateVote:
    @pytest.mark.asyncio
    async def test_create_bull_vote(self, repo, debate_with_session):
        result = await repo.create_vote(
            debate_id=debate_with_session.id,
            debate_external_id=debate_with_session.external_id,
            choice="bull",
            voter_fingerprint="fp_vote_001",
        )
        assert isinstance(result, VoteResponse)
        assert result.choice == "bull"
        assert result.debate_id == debate_with_session.external_id
        assert result.voter_fingerprint == "fp_vote_001"
        assert result.vote_id is not None
        assert result.created_at is not None

    @pytest.mark.asyncio
    async def test_create_bear_vote(self, repo, debate_with_session):
        result = await repo.create_vote(
            debate_id=debate_with_session.id,
            debate_external_id=debate_with_session.external_id,
            choice="bear",
            voter_fingerprint="fp_vote_002",
        )
        assert result.choice == "bear"

    @pytest.mark.asyncio
    async def test_create_undecided_vote(self, repo, debate_with_session):
        result = await repo.create_vote(
            debate_id=debate_with_session.id,
            debate_external_id=debate_with_session.external_id,
            choice="undecided",
            voter_fingerprint="fp_vote_003",
        )
        assert result.choice == "undecided"


class TestHasExistingVote:
    @pytest.mark.asyncio
    async def test_no_existing_vote(self, repo, debate_with_session):
        exists = await repo.has_existing_vote(
            debate_id=debate_with_session.id,
            voter_fingerprint="fp_new_user",
        )
        assert exists is False

    @pytest.mark.asyncio
    async def test_existing_vote(self, repo, debate_with_session):
        await repo.create_vote(
            debate_id=debate_with_session.id,
            debate_external_id=debate_with_session.external_id,
            choice="bull",
            voter_fingerprint="fp_existing",
        )

        exists = await repo.has_existing_vote(
            debate_id=debate_with_session.id,
            voter_fingerprint="fp_existing",
        )
        assert exists is True

    @pytest.mark.asyncio
    async def test_same_fingerprint_different_debate(self, repo, db_session):
        debate1 = Debate(external_id=f"deb_multi1_{uuid4().hex[:8]}", asset="btc")
        debate2 = Debate(external_id=f"deb_multi2_{uuid4().hex[:8]}", asset="eth")
        db_session.add_all([debate1, debate2])
        await db_session.commit()
        await db_session.refresh(debate1)
        await db_session.refresh(debate2)

        await repo.create_vote(
            debate_id=debate1.id,
            debate_external_id=debate1.external_id,
            choice="bull",
            voter_fingerprint="fp_cross",
        )

        exists_debate2 = await repo.has_existing_vote(
            debate_id=debate2.id,
            voter_fingerprint="fp_cross",
        )
        assert exists_debate2 is False


class TestGetResult:
    @pytest.mark.asyncio
    async def test_result_with_votes(self, repo, debate_with_session):
        await repo.create_vote(
            debate_id=debate_with_session.id,
            debate_external_id=debate_with_session.external_id,
            choice="bull",
            voter_fingerprint="fp_res_1",
        )
        await repo.create_vote(
            debate_id=debate_with_session.id,
            debate_external_id=debate_with_session.external_id,
            choice="bull",
            voter_fingerprint="fp_res_2",
        )
        await repo.create_vote(
            debate_id=debate_with_session.id,
            debate_external_id=debate_with_session.external_id,
            choice="bear",
            voter_fingerprint="fp_res_3",
        )

        result = await repo.get_result(debate_with_session.external_id)
        assert isinstance(result, DebateResultResponse)
        assert result.total_votes == 3
        assert result.vote_breakdown["bull"] == 2
        assert result.vote_breakdown["bear"] == 1

    @pytest.mark.asyncio
    async def test_result_no_votes(self, repo, debate_with_session):
        result = await repo.get_result(debate_with_session.external_id)
        assert result is not None
        assert result.total_votes == 0
        assert result.vote_breakdown == {}

    @pytest.mark.asyncio
    async def test_result_not_found(self, repo):
        result = await repo.get_result("deb_nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_result_camel_case_serialization(self, repo, debate_with_session):
        await repo.create_vote(
            debate_id=debate_with_session.id,
            debate_external_id=debate_with_session.external_id,
            choice="bull",
            voter_fingerprint="fp_camel",
        )

        result = await repo.get_result(debate_with_session.external_id)
        dumped = result.model_dump(by_alias=True)
        assert "debateId" in dumped
        assert "guardianVerdict" in dumped
        assert "guardianInterruptsCount" in dumped
        assert "totalVotes" in dumped
        assert "voteBreakdown" in dumped
        assert "createdAt" in dumped
        assert "completedAt" in dumped


class TestRepositoryVoteConcurrency:
    @pytest.mark.asyncio
    async def test_duplicate_vote_raises_on_second_insert(
        self, repo, db_session, debate_with_session
    ):
        from sqlalchemy.exc import IntegrityError

        vote1 = Vote(
            debate_id=debate_with_session.id,
            choice="bull",
            voter_fingerprint="fp_concurrent",
        )
        db_session.add(vote1)
        await db_session.commit()

        vote2 = Vote(
            debate_id=debate_with_session.id,
            choice="bear",
            voter_fingerprint="fp_concurrent",
        )
        db_session.add(vote2)
        with pytest.raises(IntegrityError):
            await db_session.commit()
