import pytest
import pytest_asyncio
from unittest.mock import patch
from datetime import datetime, timezone

from httpx import AsyncClient, ASGITransport

from app.main import app
from app.database import get_async_session
from app.models import Debate


ACTIVE_URL = "/api/debate/active"


@pytest_asyncio.fixture(scope="function")
async def integ_client(db_session):
    async def override_session():
        yield db_session

    app.dependency_overrides[get_async_session] = override_session
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost:8000"
    ) as client:
        async with app.router.lifespan_context(app):
            yield client
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_full_round_trip_active_debate(integ_client, db_session):
    with patch("app.services.debate.cache.get_cached_active_debate", return_value=None):
        debate = Debate(
            external_id="deb_integ_001",
            asset="btc",
            status="running",
            current_turn=2,
            max_turns=6,
            created_at=datetime(2026, 4, 15, 14, 0, tzinfo=timezone.utc),
        )
        db_session.add(debate)
        await db_session.commit()

        resp = await integ_client.get(ACTIVE_URL)
        assert resp.status_code == 200

        body = resp.json()
        assert set(body.keys()) == {"data", "error", "meta"}
        assert body["error"] is None
        assert isinstance(body["meta"], dict)
        assert "latencyMs" in body["meta"]

        data = body["data"]
        assert data is not None
        expected_data_keys = {"id", "asset", "status", "startedAt", "viewerCount"}
        assert set(data.keys()) == expected_data_keys
        assert data["id"] == "deb_integ_001"
        assert data["asset"] == "btc"
        assert data["status"] == "active"
        assert data["viewerCount"] is None


@pytest.mark.asyncio
async def test_full_round_trip_null_debate(integ_client):
    with patch("app.services.debate.cache.get_cached_active_debate", return_value=None):
        resp = await integ_client.get(ACTIVE_URL)
        assert resp.status_code == 200

        body = resp.json()
        assert set(body.keys()) == {"data", "error", "meta"}
        assert body["data"] is None
        assert body["error"] is None


@pytest.mark.asyncio
async def test_cache_control_round_trip(integ_client):
    with patch("app.services.debate.cache.get_cached_active_debate", return_value=None):
        resp = await integ_client.get(ACTIVE_URL)
        cc = resp.headers.get("cache-control", "")
        assert "s-maxage=15" in cc
        assert "stale-while-revalidate=30" in cc
