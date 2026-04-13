import pytest
import pytest_asyncio
from datetime import datetime, timezone
from uuid import uuid4

from httpx import AsyncClient, ASGITransport

from app.main import app
from app.database import get_async_session
from app.models import Debate, Vote


HISTORY_URL = "/api/debate/history"


@pytest_asyncio.fixture(scope="function")
async def history_client(db_session):
    async def override_session():
        yield db_session

    app.dependency_overrides[get_async_session] = override_session
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost:8000"
    ) as client:
        async with app.router.lifespan_context(app):
            yield client
    app.dependency_overrides.clear()


@pytest.fixture
def make_completed_debate():
    def _make(
        ext_id: str | None = None,
        asset: str = "bitcoin",
        created_at: datetime | None = None,
        completed_at: datetime | None = None,
    ):
        return Debate(
            external_id=ext_id or f"deb_{uuid4().hex[:8]}",
            asset=asset,
            status="completed",
            current_turn=6,
            max_turns=6,
            guardian_verdict="Caution",
            guardian_interrupts_count=0,
            created_at=created_at or datetime(2026, 1, 1, tzinfo=timezone.utc),
            completed_at=completed_at or datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
        )

    return _make


@pytest.fixture
def make_running_debate():
    def _make(ext_id: str | None = None, asset: str = "bitcoin"):
        return Debate(
            external_id=ext_id or f"deb_{uuid4().hex[:8]}",
            asset=asset,
            status="running",
            current_turn=3,
            max_turns=6,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )

    return _make


async def seed_votes(
    db_session, debate_id, bull: int = 0, bear: int = 0, undecided: int = 0
):
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


class TestWinnerDerivation:
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
        self, db_session, history_client, make_completed_debate, bull, bear, expected
    ):
        debate = make_completed_debate()
        db_session.add(debate)
        await db_session.commit()

        await seed_votes(db_session, debate.id, bull=bull, bear=bear)

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
        bull,
        bear,
        undecided,
        expected,
    ):
        debate = make_completed_debate()
        db_session.add(debate)
        await db_session.commit()

        await seed_votes(
            db_session, debate.id, bull=bull, bear=bear, undecided=undecided
        )

        resp = await history_client.get(HISTORY_URL)
        body = resp.json()
        items = body["data"]
        assert len(items) == 1
        assert items[0]["winner"] == expected


class TestCountQuerySeparation:
    @pytest.mark.asyncio
    async def test_count_no_lateral_without_outcome(
        self, db_session, history_client, make_completed_debate
    ):
        for i in range(5):
            debate = make_completed_debate(ext_id=f"deb_cnt_{i}")
            db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL)
        body = resp.json()
        assert body["meta"]["total"] == 5


class TestResponseContract:
    @pytest.mark.asyncio
    async def test_list_response_contract(
        self, db_session, history_client, make_completed_debate
    ):
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


class TestDebateStatusGate:
    @pytest.mark.asyncio
    async def test_only_completed_debates(
        self, db_session, history_client, make_completed_debate, make_running_debate
    ):
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


class TestAssetFilter:
    @pytest.mark.asyncio
    async def test_filter_by_asset(
        self, db_session, history_client, make_completed_debate
    ):
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
        resp = await history_client.get(HISTORY_URL, params={"asset": "invalid"})
        assert resp.status_code == 422


class TestNullVotes:
    @pytest.mark.asyncio
    async def test_debate_with_zero_votes(
        self, db_session, history_client, make_completed_debate
    ):
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
        self, db_session, history_client, make_completed_debate
    ):
        debate = make_completed_debate(ext_id="deb_breakdown_und")
        db_session.add(debate)
        await db_session.commit()

        await seed_votes(db_session, debate.id, bull=2, bear=1, undecided=3)

        resp = await history_client.get(HISTORY_URL)
        body = resp.json()
        item = body["data"][0]
        assert item["voteBreakdown"]["bull"] == 2
        assert item["voteBreakdown"]["bear"] == 1
        assert item["voteBreakdown"]["undecided"] == 3
        assert item["totalVotes"] == 6


class TestPaginationOutcomeInteraction:
    @pytest.mark.asyncio
    async def test_total_count_with_outcome_filter(
        self, db_session, history_client, make_completed_debate
    ):
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
            await seed_votes(db_session, debate.id, **dist)

        resp = await history_client.get(HISTORY_URL, params={"outcome": "bull"})
        body = resp.json()
        assert body["meta"]["total"] == 2
        assert len(body["data"]) == 2
        for item in body["data"]:
            assert item["winner"] == "bull"

    @pytest.mark.asyncio
    async def test_outcome_filter_empty_result(
        self, db_session, history_client, make_completed_debate
    ):
        debate = make_completed_debate(ext_id="deb_only_bear")
        db_session.add(debate)
        await db_session.commit()
        await seed_votes(db_session, debate.id, bull=1, bear=5)

        resp = await history_client.get(HISTORY_URL, params={"outcome": "bull"})
        body = resp.json()
        assert body["meta"]["total"] == 0
        assert body["meta"]["pages"] == 0
        assert body["data"] == []

    @pytest.mark.asyncio
    async def test_pagination_across_pages(
        self, db_session, history_client, make_completed_debate
    ):
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


class TestRouteValidation:
    @pytest.mark.asyncio
    async def test_default_params(self, history_client):
        resp = await history_client.get(HISTORY_URL)
        assert resp.status_code == 200
        body = resp.json()
        assert body["meta"]["page"] == 1
        assert body["meta"]["size"] == 20

    @pytest.mark.asyncio
    async def test_invalid_outcome_returns_422(self, history_client):
        resp = await history_client.get(HISTORY_URL, params={"outcome": "invalid"})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_invalid_asset_returns_422(self, history_client):
        resp = await history_client.get(HISTORY_URL, params={"asset": "BADASSET"})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_valid_outcome_bull(
        self, db_session, history_client, make_completed_debate
    ):
        debate = make_completed_debate(ext_id="deb_outcome_bull")
        db_session.add(debate)
        await db_session.commit()
        await seed_votes(db_session, debate.id, bull=3, bear=1)

        resp = await history_client.get(HISTORY_URL, params={"outcome": "bull"})
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 1

    @pytest.mark.asyncio
    async def test_valid_outcome_bear(
        self, db_session, history_client, make_completed_debate
    ):
        debate = make_completed_debate(ext_id="deb_outcome_bear")
        db_session.add(debate)
        await db_session.commit()
        await seed_votes(db_session, debate.id, bull=1, bear=3)

        resp = await history_client.get(HISTORY_URL, params={"outcome": "bear"})
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 1

    @pytest.mark.asyncio
    async def test_valid_outcome_undecided(
        self, db_session, history_client, make_completed_debate
    ):
        debate = make_completed_debate(ext_id="deb_outcome_tie")
        db_session.add(debate)
        await db_session.commit()
        await seed_votes(db_session, debate.id, bull=2, bear=2)

        resp = await history_client.get(HISTORY_URL, params={"outcome": "undecided"})
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 1

    @pytest.mark.asyncio
    async def test_combined_asset_and_outcome(
        self, db_session, history_client, make_completed_debate
    ):
        btc_bull = make_completed_debate(ext_id="deb_btc_bull", asset="bitcoin")
        eth_bear = make_completed_debate(ext_id="deb_eth_bear", asset="ethereum")
        btc_bear = make_completed_debate(ext_id="deb_btc_bear", asset="bitcoin")
        db_session.add_all([btc_bull, eth_bear, btc_bear])
        await db_session.flush()
        await seed_votes(db_session, btc_bull.id, bull=3, bear=1)
        await seed_votes(db_session, eth_bear.id, bull=1, bear=3)
        await seed_votes(db_session, btc_bear.id, bull=1, bear=3)

        resp = await history_client.get(
            HISTORY_URL, params={"asset": "bitcoin", "outcome": "bull"}
        )
        body = resp.json()
        assert body["meta"]["total"] == 1
        assert body["data"][0]["externalId"] == "deb_btc_bull"


class TestOrderingVerification:
    @pytest.mark.asyncio
    async def test_results_ordered_newest_first(
        self, db_session, history_client, make_completed_debate
    ):
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


class TestPaginationBoundaries:
    @pytest.mark.asyncio
    async def test_size_one(self, db_session, history_client, make_completed_debate):
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
        debate = make_completed_debate(ext_id="deb_single")
        db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL, params={"page": 1, "size": 20})
        body = resp.json()
        assert body["meta"]["total"] == 1
        assert body["meta"]["pages"] == 1
        assert len(body["data"]) == 1


class TestCaseInsensitiveFilters:
    @pytest.mark.asyncio
    async def test_asset_filter_case_insensitive(
        self, db_session, history_client, make_completed_debate
    ):
        debate = make_completed_debate(ext_id="deb_case", asset="bitcoin")
        db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL, params={"asset": "Bitcoin"})
        body = resp.json()
        assert body["meta"]["total"] == 1

    @pytest.mark.asyncio
    async def test_outcome_filter_case_insensitive(
        self, db_session, history_client, make_completed_debate
    ):
        debate = make_completed_debate(ext_id="deb_case_outcome")
        db_session.add(debate)
        await db_session.commit()
        await seed_votes(db_session, debate.id, bull=3, bear=1)

        resp = await history_client.get(HISTORY_URL, params={"outcome": "BULL"})
        body = resp.json()
        assert body["meta"]["total"] == 1

    @pytest.mark.asyncio
    async def test_asset_with_whitespace(
        self, db_session, history_client, make_completed_debate
    ):
        debate = make_completed_debate(ext_id="deb_ws", asset="bitcoin")
        db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL, params={"asset": "  bitcoin  "})
        body = resp.json()
        assert body["meta"]["total"] == 1


class TestSchemaSerialization:
    @pytest.mark.asyncio
    async def test_camel_case_field_names(
        self, db_session, history_client, make_completed_debate
    ):
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
    async def test_null_guardian_verdict_serializes(
        self, db_session, history_client, make_completed_debate
    ):
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


class TestEmptyDatabase:
    @pytest.mark.asyncio
    async def test_empty_db_returns_200_with_empty_data(self, history_client):
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
        resp = await history_client.get(HISTORY_URL, params={"asset": "bitcoin"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] == []
        assert body["meta"]["total"] == 0

    @pytest.mark.asyncio
    async def test_empty_db_with_outcome_filter(self, history_client):
        resp = await history_client.get(HISTORY_URL, params={"outcome": "bull"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] == []
        assert body["meta"]["total"] == 0


class TestSizeBoundaryValidation:
    @pytest.mark.asyncio
    async def test_size_max_100(
        self, db_session, history_client, make_completed_debate
    ):
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
        resp = await history_client.get(HISTORY_URL, params={"page": 0})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_size_zero_rejected(self, history_client):
        resp = await history_client.get(HISTORY_URL, params={"size": 0})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_size_exceeds_max_rejected(self, history_client):
        resp = await history_client.get(HISTORY_URL, params={"size": 101})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_negative_page_rejected(self, history_client):
        resp = await history_client.get(HISTORY_URL, params={"page": -1})
        assert resp.status_code == 422


class TestErrorResponseBodyContract:
    @pytest.mark.asyncio
    async def test_invalid_asset_error_body_shape(self, history_client):
        resp = await history_client.get(HISTORY_URL, params={"asset": "DOGE"})
        assert resp.status_code == 422
        body = resp.json()
        detail = body.get("detail", body)
        assert "error" in detail
        assert detail["error"]["code"] == "INVALID_ASSET"
        assert "Unsupported asset" in detail["error"]["message"]

    @pytest.mark.asyncio
    async def test_invalid_outcome_error_body_shape(self, history_client):
        resp = await history_client.get(HISTORY_URL, params={"outcome": "tie"})
        assert resp.status_code == 422
        body = resp.json()
        detail = body.get("detail", body)
        assert detail["error"]["code"] == "INVALID_OUTCOME"
        assert "Invalid outcome" in detail["error"]["message"]


class TestOutcomeFilterWithUndecidedVotes:
    @pytest.mark.asyncio
    async def test_outcome_undecided_returns_undecided_winners(
        self, db_session, history_client, make_completed_debate
    ):
        debate_und = make_completed_debate(ext_id="deb_und_winner")
        db_session.add(debate_und)
        await db_session.flush()
        await seed_votes(db_session, debate_und.id, bull=1, bear=1, undecided=5)

        debate_bull = make_completed_debate(ext_id="deb_bull_winner")
        db_session.add(debate_bull)
        await db_session.flush()
        await seed_votes(db_session, debate_bull.id, bull=5, bear=1)

        resp = await history_client.get(HISTORY_URL, params={"outcome": "undecided"})
        body = resp.json()
        assert body["meta"]["total"] == 1
        assert body["data"][0]["externalId"] == "deb_und_winner"
        assert body["data"][0]["winner"] == "undecided"

    @pytest.mark.asyncio
    async def test_outcome_undecided_excludes_bull_and_bear_winners(
        self, db_session, history_client, make_completed_debate
    ):
        debate_bull = make_completed_debate(ext_id="deb_only_bull_w")
        db_session.add(debate_bull)
        await db_session.flush()
        await seed_votes(db_session, debate_bull.id, bull=5, bear=1)

        debate_bear = make_completed_debate(ext_id="deb_only_bear_w")
        db_session.add(debate_bear)
        await db_session.flush()
        await seed_votes(db_session, debate_bear.id, bull=1, bear=5)

        resp = await history_client.get(HISTORY_URL, params={"outcome": "undecided"})
        body = resp.json()
        assert body["meta"]["total"] == 0
        assert body["data"] == []


class TestConcurrentDebatesSameAsset:
    @pytest.mark.asyncio
    async def test_multiple_debates_same_asset_all_returned(
        self, db_session, history_client, make_completed_debate
    ):
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


class TestGuardianVerdictField:
    @pytest.mark.asyncio
    async def test_populated_guardian_verdict(
        self, db_session, history_client, make_completed_debate
    ):
        debate = make_completed_debate(ext_id="deb_gv_set")
        debate.guardian_verdict = "High Risk"
        db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL)
        item = resp.json()["data"][0]
        assert item["guardianVerdict"] == "High Risk"

    @pytest.mark.asyncio
    async def test_nonzero_guardian_interrupts_count(self, db_session, history_client):
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
    @pytest.mark.asyncio
    async def test_completed_at_null_when_not_set(self, db_session, history_client):
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
    @pytest.mark.asyncio
    async def test_only_bull_votes_no_bear_key(
        self, db_session, history_client, make_completed_debate
    ):
        debate = make_completed_debate(ext_id="deb_bd_omit")
        db_session.add(debate)
        await db_session.commit()
        await seed_votes(db_session, debate.id, bull=5, bear=0, undecided=0)

        resp = await history_client.get(HISTORY_URL)
        item = resp.json()["data"][0]
        assert item["voteBreakdown"] == {"bull": 5}
        assert "bear" not in item["voteBreakdown"]
        assert "undecided" not in item["voteBreakdown"]

    @pytest.mark.asyncio
    async def test_only_bear_votes_no_bull_key(
        self, db_session, history_client, make_completed_debate
    ):
        debate = make_completed_debate(ext_id="deb_bd_bear_only")
        db_session.add(debate)
        await db_session.commit()
        await seed_votes(db_session, debate.id, bull=0, bear=3, undecided=0)

        resp = await history_client.get(HISTORY_URL)
        item = resp.json()["data"][0]
        assert item["voteBreakdown"] == {"bear": 3}
        assert "bull" not in item["voteBreakdown"]


class TestAllSupportedAssets:
    @pytest.mark.parametrize(
        "asset",
        ["bitcoin", "btc", "ethereum", "eth", "solana", "sol"],
    )
    @pytest.mark.asyncio
    async def test_each_supported_asset_passes_validation(
        self, db_session, history_client, make_completed_debate, asset
    ):
        debate = make_completed_debate(ext_id=f"deb_asset_{asset}", asset=asset)
        db_session.add(debate)
        await db_session.commit()

        resp = await history_client.get(HISTORY_URL, params={"asset": asset})
        assert resp.status_code == 200
        assert resp.json()["meta"]["total"] == 1
