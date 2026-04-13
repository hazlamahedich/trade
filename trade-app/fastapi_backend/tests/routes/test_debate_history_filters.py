import pytest

from tests.conftest_history import HISTORY_URL


class TestAssetFilter:
    """P1 — Asset filter parameter (AC-2)"""

    @pytest.mark.asyncio
    async def test_filter_by_asset(
        self, db_session, history_client, make_completed_debate
    ):
        """ID: 4.2a-RT-004 — Filter returns only matching asset"""
        btc_debate = make_completed_debate(ext_id="deb_btc", asset="bitcoin")
        eth_debate = make_completed_debate(ext_id="deb_eth", asset="ethereum")
        db_session.add_all([btc_debate, eth_debate])
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL, params={"asset": "bitcoin"})
        body = resp.json()
        assert body["meta"]["total"] == 1
        assert body["data"][0]["externalId"] == "deb_btc"

    @pytest.mark.asyncio
    async def test_invalid_asset_returns_422(self, history_client):
        """ID: 4.2a-RT-005 — Invalid asset returns 422"""
        resp = await history_client.get(HISTORY_URL, params={"asset": "invalid"})
        assert resp.status_code == 422


class TestCaseInsensitiveFilters:
    """P1 — Case-insensitive asset and outcome filters"""

    @pytest.mark.asyncio
    async def test_asset_filter_case_insensitive(
        self, db_session, history_client, make_completed_debate
    ):
        """ID: 4.2a-RT-006 — Asset filter ignores case"""
        debate = make_completed_debate(ext_id="deb_case", asset="bitcoin")
        db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL, params={"asset": "Bitcoin"})
        body = resp.json()
        assert body["meta"]["total"] == 1

    @pytest.mark.asyncio
    async def test_outcome_filter_case_insensitive(
        self, db_session, history_client, make_completed_debate, seed_votes
    ):
        """ID: 4.2a-RT-007 — Outcome filter ignores case"""
        debate = make_completed_debate(ext_id="deb_case_outcome")
        db_session.add(debate)
        await db_session.commit()
        await seed_votes(debate.id, bull=3, bear=1)

        resp = await history_client.get(HISTORY_URL, params={"outcome": "BULL"})
        body = resp.json()
        assert body["meta"]["total"] == 1

    @pytest.mark.asyncio
    async def test_asset_with_whitespace(
        self, db_session, history_client, make_completed_debate
    ):
        """ID: 4.2a-RT-008 — Asset filter trims whitespace"""
        debate = make_completed_debate(ext_id="deb_ws", asset="bitcoin")
        db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL, params={"asset": "  bitcoin  "})
        body = resp.json()
        assert body["meta"]["total"] == 1


class TestAllSupportedAssets:
    """P1 — All 6 supported assets pass validation"""

    @pytest.mark.parametrize(
        "asset",
        ["bitcoin", "btc", "ethereum", "eth", "solana", "sol"],
    )
    @pytest.mark.asyncio
    async def test_each_supported_asset_passes_validation(
        self, db_session, history_client, make_completed_debate, asset
    ):
        """ID: 4.2a-RT-009 — Parametrized: each supported asset validates"""
        debate = make_completed_debate(ext_id=f"deb_asset_{asset}", asset=asset)
        db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL, params={"asset": asset})
        assert resp.status_code == 200
        assert resp.json()["meta"]["total"] == 1


class TestOutcomeFilterWithUndecidedVotes:
    """P1 — Outcome filter with undecided winners (AC-3)"""

    @pytest.mark.asyncio
    async def test_outcome_undecided_returns_undecided_winners(
        self, db_session, history_client, make_completed_debate, seed_votes
    ):
        """ID: 4.2a-RT-010 — outcome=undecided returns only undecided winners"""
        debate_und = make_completed_debate(ext_id="deb_und_winner")
        db_session.add(debate_und)
        await db_session.flush()
        await seed_votes(debate_und.id, bull=1, bear=1, undecided=5)

        debate_bull = make_completed_debate(ext_id="deb_bull_winner")
        db_session.add(debate_bull)
        await db_session.flush()
        await seed_votes(debate_bull.id, bull=5, bear=1)

        resp = await history_client.get(HISTORY_URL, params={"outcome": "undecided"})
        body = resp.json()
        assert body["meta"]["total"] == 1
        assert body["data"][0]["externalId"] == "deb_und_winner"
        assert body["data"][0]["winner"] == "undecided"

    @pytest.mark.asyncio
    async def test_outcome_undecided_excludes_bull_and_bear_winners(
        self, db_session, history_client, make_completed_debate, seed_votes
    ):
        """ID: 4.2a-RT-011 — outcome=undecided excludes bull/bear winners"""
        debate_bull = make_completed_debate(ext_id="deb_only_bull_w")
        db_session.add(debate_bull)
        await db_session.flush()
        await seed_votes(debate_bull.id, bull=5, bear=1)

        debate_bear = make_completed_debate(ext_id="deb_only_bear_w")
        db_session.add(debate_bear)
        await db_session.flush()
        await seed_votes(debate_bear.id, bull=1, bear=5)

        resp = await history_client.get(HISTORY_URL, params={"outcome": "undecided"})
        body = resp.json()
        assert body["meta"]["total"] == 0
        assert body["data"] == []


class TestDebateStatusGate:
    """P0 — Only completed debates appear in history (AC-1)"""

    @pytest.mark.asyncio
    async def test_only_completed_debates(
        self,
        db_session,
        history_client,
        make_completed_debate,
        make_running_debate,
    ):
        """ID: 4.2a-RT-012 — Running debates excluded from history"""
        completed = make_completed_debate(ext_id="deb_completed_1")
        db_session.add(completed)
        running = make_running_debate(ext_id="deb_running_1")
        db_session.add(running)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL)
        body = resp.json()
        assert body["meta"]["total"] == 1
        assert len(body["data"]) == 1
        assert body["data"][0]["externalId"] == "deb_completed_1"
