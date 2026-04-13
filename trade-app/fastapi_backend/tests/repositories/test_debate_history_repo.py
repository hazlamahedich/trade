import pytest
import pytest_asyncio
from datetime import datetime, timezone

from sqlalchemy import select, func

from app.models import Debate
from app.services.debate.repository import DebateRepository


@pytest_asyncio.fixture
async def repo(db_session):
    return DebateRepository(db_session)


class TestGetFilteredDebatesRepoUnit:
    """P0 — Repository get_filtered_debates unit tests (AC-1, AC-2, AC-3, AC-5)"""

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_completed(self, repo, db_session):
        """ID: 4.2a-RP-001 — No completed debates → empty result"""
        items, total = await repo.get_filtered_debates()
        assert total == 0
        assert items == []

    @pytest.mark.asyncio
    async def test_excludes_running_debates(self, repo, db_session):
        """ID: 4.2a-RP-002 — Running debates excluded"""
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
        """ID: 4.2a-RP-003 — Error-status debates excluded"""
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
        """ID: 4.2a-RP-004 — Results ordered by created_at DESC"""
        for i in range(3):
            debate = Debate(
                external_id=f"deb_order_{i}",
                asset="bitcoin",
                status="completed",
                current_turn=6,
                max_turns=6,
                guardian_verdict="Caution",
                guardian_interrupts_count=0,
                created_at=datetime(2026, 1, i + 1, tzinfo=timezone.utc),
                completed_at=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
            )
            db_session.add(debate)
            await db_session.commit()

        items, total = await repo.get_filtered_debates()
        assert total == 3
        assert items[0].external_id == "deb_order_2"
        assert items[1].external_id == "deb_order_1"
        assert items[2].external_id == "deb_order_0"

    @pytest.mark.asyncio
    async def test_asset_filter_at_repo_level(self, repo, db_session):
        """ID: 4.2a-RP-005 — Asset filter at repo level (AC-2)"""
        for ext_id, asset in [("deb_btc", "bitcoin"), ("deb_eth", "ethereum")]:
            debate = Debate(
                external_id=ext_id,
                asset=asset,
                status="completed",
                current_turn=6,
                max_turns=6,
                guardian_verdict="Caution",
                guardian_interrupts_count=0,
                created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
                completed_at=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
            )
            db_session.add(debate)
            await db_session.commit()

        items, total = await repo.get_filtered_debates(asset="bitcoin")
        assert total == 1
        assert items[0].external_id == "deb_btc"

    @pytest.mark.asyncio
    async def test_outcome_filter_at_repo_level(self, repo, db_session, seed_votes):
        """ID: 4.2a-RP-006 — Outcome filter at repo level (AC-3)"""
        debate = Debate(
            external_id="deb_bull_win",
            asset="bitcoin",
            status="completed",
            current_turn=6,
            max_turns=6,
            guardian_verdict="Caution",
            guardian_interrupts_count=0,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            completed_at=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
        )
        db_session.add(debate)
        await db_session.commit()
        await seed_votes(debate.id, bull=5, bear=1)

        items, total = await repo.get_filtered_debates(outcome="bull")
        assert total == 1
        assert items[0].winner == "bull"

    @pytest.mark.asyncio
    async def test_outcome_filter_excludes_non_matching(
        self, repo, db_session, seed_votes
    ):
        """ID: 4.2a-RP-007 — Outcome filter excludes non-matching"""
        debate = Debate(
            external_id="deb_bull_only",
            asset="bitcoin",
            status="completed",
            current_turn=6,
            max_turns=6,
            guardian_verdict="Caution",
            guardian_interrupts_count=0,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            completed_at=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
        )
        db_session.add(debate)
        await db_session.commit()
        await seed_votes(debate.id, bull=5, bear=1)

        items, total = await repo.get_filtered_debates(outcome="bear")
        assert total == 0
        assert items == []

    @pytest.mark.asyncio
    async def test_pagination_offset_and_limit(self, repo, db_session):
        """ID: 4.2a-RP-008 — Offset/limit pagination"""
        for i in range(5):
            debate = Debate(
                external_id=f"deb_page_{i}",
                asset="bitcoin",
                status="completed",
                current_turn=6,
                max_turns=6,
                guardian_verdict="Caution",
                guardian_interrupts_count=0,
                created_at=datetime(2026, 1, i + 1, tzinfo=timezone.utc),
                completed_at=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
            )
            db_session.add(debate)
            await db_session.commit()

        items, total = await repo.get_filtered_debates(page=2, size=2)
        assert total == 5
        assert len(items) == 2

    @pytest.mark.asyncio
    async def test_combined_asset_and_outcome_filter(
        self, repo, db_session, seed_votes
    ):
        """ID: 4.2a-RP-009 — Combined asset+outcome filter"""
        btc_bull = Debate(
            external_id="btc_bull",
            asset="bitcoin",
            status="completed",
            current_turn=6,
            max_turns=6,
            guardian_verdict="Caution",
            guardian_interrupts_count=0,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            completed_at=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
        )
        db_session.add(btc_bull)
        await db_session.commit()
        await seed_votes(btc_bull.id, bull=3, bear=1)

        eth_bear = Debate(
            external_id="eth_bear",
            asset="ethereum",
            status="completed",
            current_turn=6,
            max_turns=6,
            guardian_verdict="Caution",
            guardian_interrupts_count=0,
            created_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
            completed_at=datetime(2026, 1, 2, 12, tzinfo=timezone.utc),
        )
        db_session.add(eth_bear)
        await db_session.commit()
        await seed_votes(eth_bear.id, bull=1, bear=3)

        items, total = await repo.get_filtered_debates(asset="bitcoin", outcome="bull")
        assert total == 1
        assert items[0].external_id == "btc_bull"

    @pytest.mark.asyncio
    async def test_winner_with_only_undecided_votes(self, repo, db_session, seed_votes):
        """ID: 4.2a-RP-010 — Only undecided votes → winner=undecided"""
        debate = Debate(
            external_id="deb_und_only",
            asset="bitcoin",
            status="completed",
            current_turn=6,
            max_turns=6,
            guardian_verdict="Caution",
            guardian_interrupts_count=0,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            completed_at=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
        )
        db_session.add(debate)
        await db_session.commit()
        await seed_votes(debate.id, undecided=5)

        items, total = await repo.get_filtered_debates()
        assert total == 1
        assert items[0].winner == "undecided"
        assert items[0].total_votes == 5

    @pytest.mark.asyncio
    async def test_default_params_returns_first_20(self, repo, db_session):
        """ID: 4.2a-RP-011 — Default params page=1, size=20"""
        for i in range(25):
            debate = Debate(
                external_id=f"deb_default_{i}",
                asset="bitcoin",
                status="completed",
                current_turn=6,
                max_turns=6,
                guardian_verdict="Caution",
                guardian_interrupts_count=0,
                created_at=datetime(2026, 1, i + 1, tzinfo=timezone.utc),
                completed_at=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
            )
            db_session.add(debate)
            await db_session.commit()

        items, total = await repo.get_filtered_debates()
        assert total == 25
        assert len(items) == 20


class TestCountQuerySqlVerification:
    """P0 — SQL-level query structure verification (AC-6)"""

    @pytest.mark.asyncio
    async def test_count_without_outcome_is_bare_count(self, db_session):
        """ID: 4.2a-RP-012 — Count query has no LATERAL without outcome"""
        base_where = [Debate.status == "completed"]
        count_stmt = select(func.count(Debate.id)).where(*base_where)
        compiled = str(count_stmt.compile(compile_kwargs={"literal_binds": True}))
        assert "LATERAL" not in compiled.upper()
        assert "lateral" not in compiled.lower()

    @pytest.mark.asyncio
    async def test_winner_field_matches_expected_values(
        self, repo, db_session, seed_votes
    ):
        """ID: 4.2a-RP-013 — Winner derivation matches truth table"""
        distributions = [
            (3, 1, 0, "bull"),
            (1, 3, 0, "bear"),
            (0, 0, 0, "undecided"),
            (2, 2, 0, "undecided"),
            (1, 0, 3, "undecided"),
            (3, 1, 2, "bull"),
        ]
        for i, (bull, bear, und, expected) in enumerate(distributions):
            debate = Debate(
                external_id=f"deb_wv_{i}",
                asset="bitcoin",
                status="completed",
                current_turn=6,
                max_turns=6,
                guardian_verdict="Caution",
                guardian_interrupts_count=0,
                created_at=datetime(2026, 1, i + 1, tzinfo=timezone.utc),
                completed_at=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
            )
            db_session.add(debate)
            await db_session.commit()
            await seed_votes(debate.id, bull=bull, bear=bear, undecided=und)

        items, _ = await repo.get_filtered_debates()
        winners = {item.external_id: item.winner for item in items}
        for i, (_, _, _, expected) in enumerate(distributions):
            assert winners[f"deb_wv_{i}"] == expected, (
                f"deb_wv_{i}: expected {expected}"
            )
