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
