import pytest
from datetime import datetime, timezone

from tests.conftest_history import HISTORY_URL


class TestPaginationBoundaries:
    """P1 — Pagination boundary conditions (AC-1)"""

    @pytest.mark.asyncio
    async def test_size_one(self, db_session, history_client, make_completed_debate):
        """ID: 4.2a-RT-013 — Page size of 1"""
        for i in range(3):
            debate = make_completed_debate(
                ext_id=f"deb_s1_{i}",
                created_at=datetime(2026, 1, i + 1, tzinfo=timezone.utc),
            )
            db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL, params={"size": 1})
        body = resp.json()
        assert len(body["data"]) == 1
        assert body["meta"]["size"] == 1
        assert body["meta"]["total"] == 3
        assert body["meta"]["pages"] == 3

    @pytest.mark.asyncio
    async def test_page_beyond_range_returns_empty(
        self, db_session, history_client, make_completed_debate
    ):
        """ID: 4.2a-RT-014 — Page beyond data range returns empty"""
        for i in range(3):
            debate = make_completed_debate(ext_id=f"deb_pbr_{i}")
            db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL, params={"page": 99, "size": 10})
        body = resp.json()
        assert resp.status_code == 200
        assert body["data"] == []
        assert body["meta"]["total"] == 3
        assert body["meta"]["page"] == 99

    @pytest.mark.asyncio
    async def test_single_debate_pagination(
        self, db_session, history_client, make_completed_debate
    ):
        """ID: 4.2a-RT-015 — Single debate paginates correctly"""
        debate = make_completed_debate(ext_id="deb_single")
        db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL, params={"page": 1, "size": 20})
        body = resp.json()
        assert body["meta"]["total"] == 1
        assert body["meta"]["pages"] == 1
        assert len(body["data"]) == 1


class TestSizeBoundaryValidation:
    """P1 — Size parameter boundary validation"""

    @pytest.mark.asyncio
    async def test_size_max_100(
        self, db_session, history_client, make_completed_debate
    ):
        """ID: 4.2a-RT-016 — Max size 100 accepted"""
        for i in range(5):
            debate = make_completed_debate(
                ext_id=f"deb_smax_{i}",
                created_at=datetime(2026, 1, i + 1, tzinfo=timezone.utc),
            )
            db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL, params={"size": 100})
        assert resp.status_code == 200
        body = resp.json()
        assert body["meta"]["size"] == 100
        assert len(body["data"]) == 5

    @pytest.mark.asyncio
    async def test_page_zero_rejected(self, history_client):
        """ID: 4.2a-RT-017 — Page=0 returns 422"""
        resp = await history_client.get(HISTORY_URL, params={"page": 0})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_size_zero_rejected(self, history_client):
        """ID: 4.2a-RT-018 — Size=0 returns 422"""
        resp = await history_client.get(HISTORY_URL, params={"size": 0})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_size_exceeds_max_rejected(self, history_client):
        """ID: 4.2a-RT-019 — Size=101 returns 422"""
        resp = await history_client.get(HISTORY_URL, params={"size": 101})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_negative_page_rejected(self, history_client):
        """ID: 4.2a-RT-020 — Page=-1 returns 422"""
        resp = await history_client.get(HISTORY_URL, params={"page": -1})
        assert resp.status_code == 422


class TestPaginationOutcomeInteraction:
    """P1 — Pagination correctness with outcome filter (AC-3, AC-6)"""

    @pytest.mark.asyncio
    async def test_total_count_with_outcome_filter(
        self, db_session, history_client, make_completed_debate, seed_votes
    ):
        """ID: 4.2a-RT-021 — Total count reflects outcome filter"""
        distributions = [
            {"bull": 3, "bear": 1},
            {"bull": 1, "bear": 3},
            {"bull": 2, "bear": 2},
            {"bull": 5, "bear": 0},
            {"bull": 0, "bear": 5},
        ]
        for i, dist in enumerate(distributions):
            debate = make_completed_debate(
                ext_id=f"deb_page_{i}",
                created_at=datetime(2026, 1, i + 1, tzinfo=timezone.utc),
            )
            db_session.add(debate)
            await db_session.flush()
            await seed_votes(debate.id, **dist)

        resp = await history_client.get(HISTORY_URL, params={"outcome": "bull"})
        body = resp.json()
        assert body["meta"]["total"] == 2
        assert len(body["data"]) == 2
        for item in body["data"]:
            assert item["winner"] == "bull"

    @pytest.mark.asyncio
    async def test_outcome_filter_empty_result(
        self, db_session, history_client, make_completed_debate, seed_votes
    ):
        """ID: 4.2a-RT-022 — Outcome filter with no matches returns empty"""
        debate = make_completed_debate(ext_id="deb_only_bear")
        db_session.add(debate)
        await db_session.commit()
        await seed_votes(debate.id, bull=1, bear=5)

        resp = await history_client.get(HISTORY_URL, params={"outcome": "bull"})
        body = resp.json()
        assert body["meta"]["total"] == 0
        assert body["meta"]["pages"] == 0
        assert body["data"] == []

    @pytest.mark.asyncio
    async def test_pagination_across_pages(
        self, db_session, history_client, make_completed_debate
    ):
        """ID: 4.2a-RT-023 — Multi-page pagination correct"""
        for i in range(7):
            debate = make_completed_debate(
                ext_id=f"deb_pag_{i}",
                created_at=datetime(2026, 1, i + 1, tzinfo=timezone.utc),
            )
            db_session.add(debate)
        await db_session.commit()

        resp1 = await history_client.get(HISTORY_URL, params={"page": 1, "size": 3})
        body1 = resp1.json()
        assert len(body1["data"]) == 3
        assert body1["meta"]["total"] == 7
        assert body1["meta"]["pages"] == 3

        resp2 = await history_client.get(HISTORY_URL, params={"page": 3, "size": 3})
        body2 = resp2.json()
        assert len(body2["data"]) == 1


class TestOrderingVerification:
    """P1 — Results ordered newest-first"""

    @pytest.mark.asyncio
    async def test_results_ordered_newest_first(
        self, db_session, history_client, make_completed_debate
    ):
        """ID: 4.2a-RT-024 — Results in descending created_at order"""
        for i in range(3):
            debate = make_completed_debate(
                ext_id=f"deb_ordered_{i}",
                created_at=datetime(2026, 1, i + 1, tzinfo=timezone.utc),
            )
            db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL)
        body = resp.json()
        dates = [item["createdAt"] for item in body["data"]]
        assert dates == sorted(dates, reverse=True)


class TestEmptyDatabase:
    """P1 — Empty database edge cases"""

    @pytest.mark.asyncio
    async def test_empty_db_returns_200_with_empty_data(self, history_client):
        """ID: 4.2a-RT-025 — Empty DB returns 200 with empty data"""
        resp = await history_client.get(HISTORY_URL)
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] == []
        assert body["meta"]["total"] == 0
        assert body["meta"]["pages"] == 0
        assert body["meta"]["page"] == 1
        assert body["meta"]["size"] == 20

    @pytest.mark.asyncio
    async def test_empty_db_with_asset_filter(self, history_client):
        """ID: 4.2a-RT-026 — Empty DB with asset filter"""
        resp = await history_client.get(HISTORY_URL, params={"asset": "bitcoin"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] == []
        assert body["meta"]["total"] == 0

    @pytest.mark.asyncio
    async def test_empty_db_with_outcome_filter(self, history_client):
        """ID: 4.2a-RT-027 — Empty DB with outcome filter"""
        resp = await history_client.get(HISTORY_URL, params={"outcome": "bull"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] == []
        assert body["meta"]["total"] == 0


class TestConcurrentDebatesSameAsset:
    """P2 — Multiple debates for same asset"""

    @pytest.mark.asyncio
    async def test_multiple_debates_same_asset_all_returned(
        self, db_session, history_client, make_completed_debate
    ):
        """ID: 4.2a-RT-028 — All same-asset debates returned"""
        for i in range(5):
            debate = make_completed_debate(
                ext_id=f"deb_multi_{i}",
                asset="btc",
                created_at=datetime(2026, 1, i + 1, tzinfo=timezone.utc),
            )
            db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL, params={"asset": "btc"})
        body = resp.json()
        assert body["meta"]["total"] == 5
        assert len(body["data"]) == 5
