import pytest
from datetime import datetime, timezone

from app.models import Debate
from tests.conftest_history import HISTORY_URL


class TestResponseContract:
    """P0 — Response envelope contract (AC-4, AC-7)"""

    @pytest.mark.asyncio
    async def test_list_response_contract(
        self, db_session, history_client, make_completed_debate
    ):
        """ID: 4.2a-RT-029 — Response shape matches {data, error, meta}"""
        debate = make_completed_debate(ext_id="deb_contract_1", asset="btc")
        db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL)
        assert resp.status_code == 200
        body = resp.json()

        assert "data" in body
        assert "error" in body
        assert "meta" in body
        assert body["error"] is None

        meta = body["meta"]
        assert "page" in meta
        assert "size" in meta
        assert "total" in meta
        assert "pages" in meta
        assert isinstance(meta["page"], int)
        assert isinstance(meta["size"], int)
        assert isinstance(meta["total"], int)
        assert isinstance(meta["pages"], int)

        items = body["data"]
        assert len(items) == 1
        item = items[0]
        expected_keys = {
            "externalId",
            "asset",
            "status",
            "guardianVerdict",
            "guardianInterruptsCount",
            "totalVotes",
            "voteBreakdown",
            "winner",
            "createdAt",
            "completedAt",
        }
        assert set(item.keys()) == expected_keys
        assert isinstance(item["totalVotes"], int)
        assert isinstance(item["voteBreakdown"], dict)
        assert isinstance(item["guardianInterruptsCount"], int)
        assert item["winner"] in ("bull", "bear", "undecided")


class TestRouteValidation:
    """P1 — Route parameter validation (AC-2, AC-3)"""

    @pytest.mark.asyncio
    async def test_default_params(self, history_client):
        """ID: 4.2a-RT-030 — Default pagination params (page=1, size=20)"""
        resp = await history_client.get(HISTORY_URL)
        assert resp.status_code == 200
        body = resp.json()
        assert body["meta"]["page"] == 1
        assert body["meta"]["size"] == 20

    @pytest.mark.asyncio
    async def test_invalid_outcome_returns_422(self, history_client):
        """ID: 4.2a-RT-031 — Invalid outcome returns 422"""
        resp = await history_client.get(HISTORY_URL, params={"outcome": "invalid"})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_asset_returns_422(self, history_client):
        """ID: 4.2a-RT-032 — Invalid asset returns 422"""
        resp = await history_client.get(HISTORY_URL, params={"asset": "BADASSET"})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_valid_outcome_bull(
        self, db_session, history_client, make_completed_debate, seed_votes
    ):
        """ID: 4.2a-RT-033 — outcome=bull with bull winner"""
        debate = make_completed_debate(ext_id="deb_outcome_bull")
        db_session.add(debate)
        await db_session.commit()
        await seed_votes(debate.id, bull=3, bear=1)

        resp = await history_client.get(HISTORY_URL, params={"outcome": "bull"})
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 1

    @pytest.mark.asyncio
    async def test_valid_outcome_bear(
        self, db_session, history_client, make_completed_debate, seed_votes
    ):
        """ID: 4.2a-RT-034 — outcome=bear with bear winner"""
        debate = make_completed_debate(ext_id="deb_outcome_bear")
        db_session.add(debate)
        await db_session.commit()
        await seed_votes(debate.id, bull=1, bear=3)

        resp = await history_client.get(HISTORY_URL, params={"outcome": "bear"})
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 1

    @pytest.mark.asyncio
    async def test_valid_outcome_undecided(
        self, db_session, history_client, make_completed_debate, seed_votes
    ):
        """ID: 4.2a-RT-035 — outcome=undecided with tie"""
        debate = make_completed_debate(ext_id="deb_outcome_tie")
        db_session.add(debate)
        await db_session.commit()
        await seed_votes(debate.id, bull=2, bear=2)

        resp = await history_client.get(HISTORY_URL, params={"outcome": "undecided"})
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 1

    @pytest.mark.asyncio
    async def test_combined_asset_and_outcome(
        self, db_session, history_client, make_completed_debate, seed_votes
    ):
        """ID: 4.2a-RT-036 — Combined asset+outcome filter"""
        btc_bull = make_completed_debate(ext_id="deb_btc_bull", asset="bitcoin")
        eth_bear = make_completed_debate(ext_id="deb_eth_bear", asset="ethereum")
        btc_bear = make_completed_debate(ext_id="deb_btc_bear", asset="bitcoin")
        db_session.add_all([btc_bull, eth_bear, btc_bear])
        await db_session.flush()
        await seed_votes(btc_bull.id, bull=3, bear=1)
        await seed_votes(eth_bear.id, bull=1, bear=3)
        await seed_votes(btc_bear.id, bull=1, bear=3)

        resp = await history_client.get(
            HISTORY_URL, params={"asset": "bitcoin", "outcome": "bull"}
        )
        body = resp.json()
        assert body["meta"]["total"] == 1
        assert body["data"][0]["externalId"] == "deb_btc_bull"


class TestSchemaSerialization:
    """P0 — CamelCase serialization and null handling (AC-7)"""

    @pytest.mark.asyncio
    async def test_camel_case_field_names(
        self, db_session, history_client, make_completed_debate
    ):
        """ID: 4.2a-RT-037 — All fields use camelCase aliases"""
        debate = make_completed_debate(ext_id="deb_camel", asset="btc")
        db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL)
        item = resp.json()["data"][0]

        assert "externalId" in item
        assert "guardianVerdict" in item
        assert "guardianInterruptsCount" in item
        assert "totalVotes" in item
        assert "voteBreakdown" in item
        assert "createdAt" in item
        assert "completedAt" in item

        assert "external_id" not in item
        assert "guardian_verdict" not in item
        assert "total_votes" not in item

    @pytest.mark.asyncio
    async def test_null_guardian_verdict_serializes(self, db_session, history_client):
        """ID: 4.2a-RT-038 — Null guardian_verdict → null in JSON"""
        debate = Debate(
            external_id="deb_null_gv",
            asset="bitcoin",
            status="completed",
            current_turn=6,
            max_turns=6,
            guardian_verdict=None,
            guardian_interrupts_count=0,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            completed_at=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
        )
        db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL)
        item = resp.json()["data"][0]
        assert item["guardianVerdict"] is None

    @pytest.mark.asyncio
    async def test_error_status_debates_excluded(
        self, db_session, history_client, make_completed_debate
    ):
        """ID: 4.2a-RT-039 — Error-status debates excluded"""
        completed = make_completed_debate(ext_id="deb_completed")
        db_session.add(completed)

        errored = Debate(
            external_id="deb_errored",
            asset="bitcoin",
            status="error",
            current_turn=2,
            max_turns=6,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        db_session.add(errored)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL)
        body = resp.json()
        assert body["meta"]["total"] == 1
        assert body["data"][0]["externalId"] == "deb_completed"


class TestErrorResponseBodyContract:
    """P1 — Error response body shape"""

    @pytest.mark.asyncio
    async def test_invalid_asset_error_body_shape(self, history_client):
        """ID: 4.2a-RT-040 — 422 error body has INVALID_ASSET code"""
        resp = await history_client.get(HISTORY_URL, params={"asset": "DOGE"})
        assert resp.status_code == 422
        body = resp.json()
        detail = body.get("detail", body)
        assert "error" in detail
        assert detail["error"]["code"] == "INVALID_ASSET"
        assert "Unsupported asset" in detail["error"]["message"]

    @pytest.mark.asyncio
    async def test_invalid_outcome_error_body_shape(self, history_client):
        """ID: 4.2a-RT-041 — 422 error body has INVALID_OUTCOME code"""
        resp = await history_client.get(HISTORY_URL, params={"outcome": "tie"})
        assert resp.status_code == 422
        body = resp.json()
        detail = body.get("detail", body)
        assert detail["error"]["code"] == "INVALID_OUTCOME"
        assert "Invalid outcome" in detail["error"]["message"]


class TestNullVotes:
    """P1 — Debates with zero votes"""

    @pytest.mark.asyncio
    async def test_debate_with_zero_votes(
        self, db_session, history_client, make_completed_debate
    ):
        """ID: 4.2a-RT-042 — Zero-vote debate → winner=undecided, totalVotes=0"""
        debate = make_completed_debate(ext_id="deb_novotes")
        db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL)
        body = resp.json()
        assert len(body["data"]) == 1
        item = body["data"][0]
        assert item["winner"] == "undecided"
        assert item["totalVotes"] == 0

    @pytest.mark.asyncio
    async def test_vote_breakdown_includes_undecided(
        self, db_session, history_client, make_completed_debate, seed_votes
    ):
        """ID: 4.2a-RT-043 — Vote breakdown includes all choices"""
        debate = make_completed_debate(ext_id="deb_breakdown_und")
        db_session.add(debate)
        await db_session.commit()

        await seed_votes(debate.id, bull=2, bear=1, undecided=3)

        resp = await history_client.get(HISTORY_URL)
        body = resp.json()
        item = body["data"][0]
        assert item["voteBreakdown"]["bull"] == 2
        assert item["voteBreakdown"]["bear"] == 1
        assert item["voteBreakdown"]["undecided"] == 3
        assert item["totalVotes"] == 6


class TestGuardianVerdictField:
    """P2 — Guardian verdict serialization"""

    @pytest.mark.asyncio
    async def test_populated_guardian_verdict(
        self, db_session, history_client, make_completed_debate
    ):
        """ID: 4.2a-RT-044 — Non-null guardian verdict serialized"""
        debate = make_completed_debate(ext_id="deb_gv_set")
        debate.guardian_verdict = "High Risk"
        db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL)
        item = resp.json()["data"][0]
        assert item["guardianVerdict"] == "High Risk"

    @pytest.mark.asyncio
    async def test_nonzero_guardian_interrupts_count(self, db_session, history_client):
        """ID: 4.2a-RT-045 — Non-zero interrupt count serialized"""
        debate = Debate(
            external_id="deb_gic",
            asset="bitcoin",
            status="completed",
            current_turn=6,
            max_turns=6,
            guardian_verdict="Caution",
            guardian_interrupts_count=7,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            completed_at=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
        )
        db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL)
        item = resp.json()["data"][0]
        assert item["guardianInterruptsCount"] == 7


class TestCompletedAtNullHandling:
    """P2 — completed_at null handling"""

    @pytest.mark.asyncio
    async def test_completed_at_null_when_not_set(self, db_session, history_client):
        """ID: 4.2a-RT-046 — Null completed_at serialized as null"""
        debate = Debate(
            external_id="deb_null_ca_route",
            asset="bitcoin",
            status="completed",
            current_turn=6,
            max_turns=6,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            completed_at=None,
        )
        db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL)
        item = resp.json()["data"][0]
        assert item["completedAt"] is None


class TestVoteBreakdownOmitsZeroKeys:
    """P1 — Vote breakdown omits zero-count keys"""

    @pytest.mark.asyncio
    async def test_only_bull_votes_no_bear_key(
        self, db_session, history_client, make_completed_debate, seed_votes
    ):
        """ID: 4.2a-RT-047 — Only bull votes → no bear/undecided keys"""
        debate = make_completed_debate(ext_id="deb_bd_omit")
        db_session.add(debate)
        await db_session.commit()
        await seed_votes(debate.id, bull=5, bear=0, undecided=0)

        resp = await history_client.get(HISTORY_URL)
        item = resp.json()["data"][0]
        assert item["voteBreakdown"] == {"bull": 5}
        assert "bear" not in item["voteBreakdown"]
        assert "undecided" not in item["voteBreakdown"]

    @pytest.mark.asyncio
    async def test_only_bear_votes_no_bull_key(
        self, db_session, history_client, make_completed_debate, seed_votes
    ):
        """ID: 4.2a-RT-048 — Only bear votes → no bull key"""
        debate = make_completed_debate(ext_id="deb_bd_bear_only")
        db_session.add(debate)
        await db_session.commit()
        await seed_votes(debate.id, bull=0, bear=3, undecided=0)

        resp = await history_client.get(HISTORY_URL)
        item = resp.json()["data"][0]
        assert item["voteBreakdown"] == {"bear": 3}
        assert "bull" not in item["voteBreakdown"]
