import pytest
import pytest_asyncio
from datetime import datetime, timezone

from sqlalchemy import select, func

from app.models import Debate, Vote
from app.services.debate.repository import DebateRepository


@pytest_asyncio.fixture
async def repo(db_session):
    return DebateRepository(db_session)


async def _make_completed_debate(db_session, ext_id, asset="bitcoin", created_at=None):
    debate = Debate(
        external_id=ext_id,
        asset=asset,
        status="completed",
        current_turn=6,
        max_turns=6,
        guardian_verdict="Caution",
        guardian_interrupts_count=0,
        created_at=created_at or datetime(2026, 1, 1, tzinfo=timezone.utc),
        completed_at=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
    )
    db_session.add(debate)
    await db_session.commit()
    return debate


async def _add_votes(db_session, debate_id, bull=0, bear=0, undecided=0):
    from uuid import uuid4

    for _ in range(bull):
        db_session.add(
            Vote(
                debate_id=debate_id,
                choice="bull",
                voter_fingerprint=f"fp_{uuid4().hex[:8]}",
            )
        )
    for _ in range(bear):
        db_session.add(
            Vote(
                debate_id=debate_id,
                choice="bear",
                voter_fingerprint=f"fp_{uuid4().hex[:8]}",
            )
        )
    for _ in range(undecided):
        db_session.add(
            Vote(
                debate_id=debate_id,
                choice="undecided",
                voter_fingerprint=f"fp_{uuid4().hex[:8]}",
            )
        )
    await db_session.commit()


class TestGetFilteredDebatesRepoUnit:
    @pytest.mark.asyncio
    async def test_returns_empty_when_no_completed(self, repo, db_session):
        items, total = await repo.get_filtered_debates()
        assert total == 0
        assert items == []

    @pytest.mark.asyncio
    async def test_excludes_running_debates(self, repo, db_session):
        running = Debate(
            external_id="deb_running",
            asset="bitcoin",
            status="running",
            current_turn=3,
            max_turns=6,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        db_session.add(running)
        await db_session.commit()

        items, total = await repo.get_filtered_debates()
        assert total == 0
        assert items == []

    @pytest.mark.asyncio
    async def test_excludes_error_debates(self, repo, db_session):
        errored = Debate(
            external_id="deb_error",
            asset="bitcoin",
            status="error",
            current_turn=2,
            max_turns=6,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        db_session.add(errored)
        await db_session.commit()

        items, total = await repo.get_filtered_debates()
        assert total == 0

    @pytest.mark.asyncio
    async def test_ordering_newest_first(self, repo, db_session):
        for i in range(3):
            await _make_completed_debate(
                db_session,
                f"deb_order_{i}",
                created_at=datetime(2026, 1, i + 1, tzinfo=timezone.utc),
            )

        items, total = await repo.get_filtered_debates()
        assert total == 3
        assert items[0].external_id == "deb_order_2"
        assert items[1].external_id == "deb_order_1"
        assert items[2].external_id == "deb_order_0"

    @pytest.mark.asyncio
    async def test_asset_filter_at_repo_level(self, repo, db_session):
        await _make_completed_debate(db_session, "deb_btc", asset="bitcoin")
        await _make_completed_debate(db_session, "deb_eth", asset="ethereum")

        items, total = await repo.get_filtered_debates(asset="bitcoin")
        assert total == 1
        assert items[0].external_id == "deb_btc"

    @pytest.mark.asyncio
    async def test_outcome_filter_at_repo_level(self, repo, db_session):
        debate = await _make_completed_debate(db_session, "deb_bull_win")
        await _add_votes(db_session, debate.id, bull=5, bear=1)

        items, total = await repo.get_filtered_debates(outcome="bull")
        assert total == 1
        assert items[0].winner == "bull"

    @pytest.mark.asyncio
    async def test_outcome_filter_excludes_non_matching(self, repo, db_session):
        debate = await _make_completed_debate(db_session, "deb_bull_only")
        await _add_votes(db_session, debate.id, bull=5, bear=1)

        items, total = await repo.get_filtered_debates(outcome="bear")
        assert total == 0
        assert items == []

    @pytest.mark.asyncio
    async def test_pagination_offset_and_limit(self, repo, db_session):
        for i in range(5):
            await _make_completed_debate(
                db_session,
                f"deb_page_{i}",
                created_at=datetime(2026, 1, i + 1, tzinfo=timezone.utc),
            )

        items, total = await repo.get_filtered_debates(page=2, size=2)
        assert total == 5
        assert len(items) == 2

    @pytest.mark.asyncio
    async def test_combined_asset_and_outcome_filter(self, repo, db_session):
        btc_bull = await _make_completed_debate(db_session, "btc_bull", asset="bitcoin")
        await _add_votes(db_session, btc_bull.id, bull=3, bear=1)

        eth_bear = await _make_completed_debate(
            db_session, "eth_bear", asset="ethereum"
        )
        await _add_votes(db_session, eth_bear.id, bull=1, bear=3)

        items, total = await repo.get_filtered_debates(asset="bitcoin", outcome="bull")
        assert total == 1
        assert items[0].external_id == "btc_bull"

    @pytest.mark.asyncio
    async def test_winner_with_only_undecided_votes(self, repo, db_session):
        debate = await _make_completed_debate(db_session, "deb_und_only")
        await _add_votes(db_session, debate.id, undecided=5)

        items, total = await repo.get_filtered_debates()
        assert total == 1
        assert items[0].winner == "undecided"
        assert items[0].total_votes == 5

    @pytest.mark.asyncio
    async def test_default_params_returns_first_20(self, repo, db_session):
        for i in range(25):
            await _make_completed_debate(
                db_session,
                f"deb_default_{i}",
                created_at=datetime(2026, 1, i + 1, tzinfo=timezone.utc),
            )

        items, total = await repo.get_filtered_debates()
        assert total == 25
        assert len(items) == 20


class TestCountQuerySqlVerification:
    @pytest.mark.asyncio
    async def test_count_without_outcome_is_bare_count(self, db_session):
        base_where = [Debate.status == "completed"]
        count_stmt = select(func.count(Debate.id)).where(*base_where)
        compiled = str(count_stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "LATERAL" not in compiled.upper()
        assert "lateral" not in compiled.lower()

    @pytest.mark.asyncio
    async def test_winner_field_matches_expected_values(self, repo, db_session):
        distributions = [
            (3, 1, 0, "bull"),
            (1, 3, 0, "bear"),
            (0, 0, 0, "undecided"),
            (2, 2, 0, "undecided"),
            (1, 0, 3, "undecided"),
            (3, 1, 2, "bull"),
        ]
        for i, (bull, bear, und, expected) in enumerate(distributions):
            debate = await _make_completed_debate(
                db_session,
                f"deb_wv_{i}",
                created_at=datetime(2026, 1, i + 1, tzinfo=timezone.utc),
            )
            await _add_votes(db_session, debate.id, bull=bull, bear=bear, undecided=und)

        items, _ = await repo.get_filtered_debates()
        winners = {item.external_id: item.winner for item in items}
        for i, (_, _, _, expected) in enumerate(distributions):
            assert winners[f"deb_wv_{i}"] == expected, (
                f"deb_wv_{i}: expected {expected}"
            )
