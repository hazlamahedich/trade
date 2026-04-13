import pytest

from tests.conftest_history import HISTORY_URL


class TestWinnerDerivation:
    """P0 — Winner derivation truth table (AC-5)"""

    @pytest.mark.parametrize(
        "bull,bear,expected",
        [
            (0, 0, "undecided"),
            (1, 0, "bull"),
            (0, 1, "bear"),
            (1, 1, "undecided"),
            (3, 2, "bull"),
            (2, 3, "bear"),
            (5, 5, "undecided"),
            (10, 0, "bull"),
            (0, 10, "bear"),
            (3, 1, "bull"),
            (1, 3, "bear"),
        ],
    )
    @pytest.mark.asyncio
    async def test_winner_truth_table(
        self,
        db_session,
        history_client,
        make_completed_debate,
        seed_votes,
        bull,
        bear,
        expected,
    ):
        """ID: 4.2a-RT-001 — Bull/bear majority → correct winner"""
        debate = make_completed_debate()
        db_session.add(debate)
        await db_session.commit()

        await seed_votes(debate.id, bull=bull, bear=bear)

        resp = await history_client.get(HISTORY_URL)
        body = resp.json()
        items = body["data"]
        assert len(items) == 1
        assert items[0]["winner"] == expected

    @pytest.mark.parametrize(
        "bull,bear,undecided,expected",
        [
            (2, 1, 5, "undecided"),
            (1, 2, 5, "undecided"),
            (3, 1, 2, "bull"),
            (1, 3, 2, "bear"),
            (0, 0, 3, "undecided"),
            (1, 1, 1, "undecided"),
        ],
    )
    @pytest.mark.asyncio
    async def test_winner_with_undecided_votes(
        self,
        db_session,
        history_client,
        make_completed_debate,
        seed_votes,
        bull,
        bear,
        undecided,
        expected,
    ):
        """ID: 4.2a-RT-002 — Winner with undecided votes mixed in"""
        debate = make_completed_debate()
        db_session.add(debate)
        await db_session.commit()

        await seed_votes(debate.id, bull=bull, bear=bear, undecided=undecided)

        resp = await history_client.get(HISTORY_URL)
        body = resp.json()
        items = body["data"]
        assert len(items) == 1
        assert items[0]["winner"] == expected


class TestCountQuerySeparation:
    """P0 — Count query excludes LATERAL when no outcome filter (AC-6)"""

    @pytest.mark.asyncio
    async def test_count_no_lateral_without_outcome(
        self, db_session, history_client, make_completed_debate
    ):
        """ID: 4.2a-RT-003 — Bare count without lateral join"""
        for i in range(5):
            debate = make_completed_debate(ext_id=f"deb_cnt_{i}")
            db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL)
        body = resp.json()
        assert body["meta"]["total"] == 5
