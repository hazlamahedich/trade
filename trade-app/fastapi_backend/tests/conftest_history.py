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


@pytest_asyncio.fixture(scope="function")
async def seed_votes(db_session):
    async def _seed(debate_id, bull: int = 0, bear: int = 0, undecided: int = 0):
        for choice, count in [
            ("bull", bull),
            ("bear", bear),
            ("undecided", undecided),
        ]:
            for _ in range(count):
                db_session.add(
                    Vote(
                        debate_id=debate_id,
                        choice=choice,
                        voter_fingerprint=f"fp_{uuid4().hex[:8]}",
                    )
                )
        await db_session.commit()

    return _seed
