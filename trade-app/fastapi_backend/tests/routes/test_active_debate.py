import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone

from httpx import AsyncClient, ASGITransport

from app.main import app
from app.database import get_async_session
from app.models import Debate


ACTIVE_URL = "/api/debate/active"


@pytest_asyncio.fixture(scope="function")
async def active_client(db_session):
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
def make_running_debate():
    def _make(ext_id: str = "deb_active_001", asset: str = "btc"):
        return Debate(
            external_id=ext_id,
            asset=asset,
            status="running",
            current_turn=3,
            max_turns=6,
            created_at=datetime(2026, 4, 15, 10, 30, tzinfo=timezone.utc),
        )

    return _make


@pytest.mark.asyncio
async def test_active_debate_returned(active_client, db_session, make_running_debate):
    with patch("app.services.debate.cache.get_cached_active_debate", return_value=None):
        debate = make_running_debate()
        db_session.add(debate)
        await db_session.commit()

        resp = await active_client.get(ACTIVE_URL)
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] is not None
        assert body["data"]["asset"] == "btc"
        assert body["data"]["status"] == "running"
        assert body["error"] is None
        assert "meta" in body


@pytest.mark.asyncio
async def test_no_active_debate_returns_null_data(active_client, db_session):
    with patch("app.services.debate.cache.get_cached_active_debate", return_value=None):
        resp = await active_client.get(ACTIVE_URL)
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] is None
        assert body["error"] is None


@pytest.mark.asyncio
async def test_multiple_active_returns_most_recent(
    active_client, db_session, make_running_debate
):
    with patch("app.services.debate.cache.get_cached_active_debate", return_value=None):
        older = make_running_debate(ext_id="deb_old", asset="eth")
        older.created_at = datetime(2026, 4, 14, tzinfo=timezone.utc)
        newer = make_running_debate(ext_id="deb_new", asset="sol")
        newer.created_at = datetime(2026, 4, 15, 12, tzinfo=timezone.utc)
        db_session.add(older)
        db_session.add(newer)
        await db_session.commit()

        resp = await active_client.get(ACTIVE_URL)
        body = resp.json()
        assert body["data"]["id"] == "deb_new"


@pytest.mark.asyncio
async def test_cache_control_header_present(active_client, db_session):
    with patch("app.services.debate.cache.get_cached_active_debate", return_value=None):
        resp = await active_client.get(ACTIVE_URL)
        assert "cache-control" in resp.headers
        cc = resp.headers["cache-control"]
        assert "s-maxage=15" in cc
        assert "stale-while-revalidate=30" in cc


@pytest.mark.asyncio
async def test_response_includes_status_field(
    active_client, db_session, make_running_debate
):
    with patch("app.services.debate.cache.get_cached_active_debate", return_value=None):
        debate = make_running_debate()
        db_session.add(debate)
        await db_session.commit()

        resp = await active_client.get(ACTIVE_URL)
        body = resp.json()
        assert "status" in body["data"]
        assert body["data"]["status"] == "running"


@pytest.mark.asyncio
async def test_cached_response_returned(active_client):
    cached_data = {
        "id": "deb_cached",
        "asset": "eth",
        "status": "running",
        "started_at": "2026-04-15T10:00:00Z",
        "viewer_count": None,
    }
    with patch(
        "app.services.debate.cache.get_cached_active_debate",
        return_value=cached_data,
    ):
        resp = await active_client.get(ACTIVE_URL)
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"]["id"] == "deb_cached"
        assert body["data"]["asset"] == "eth"


@pytest.mark.asyncio
async def test_completed_debates_excluded(active_client, db_session):
    with patch("app.services.debate.cache.get_cached_active_debate", return_value=None):
        completed = Debate(
            external_id="deb_done",
            asset="btc",
            status="completed",
            current_turn=6,
            max_turns=6,
            created_at=datetime(2026, 4, 15, tzinfo=timezone.utc),
        )
        db_session.add(completed)
        await db_session.commit()

        resp = await active_client.get(ACTIVE_URL)
        body = resp.json()
        assert body["data"] is None
