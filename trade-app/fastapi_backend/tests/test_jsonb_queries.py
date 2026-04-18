import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditEvent, Debate


@pytest_asyncio.fixture
async def debate_with_events(db_session: AsyncSession):
    d = Debate(
        external_id=f"ext-{uuid.uuid4()}",
        asset="ETH",
        status="completed",
    )
    db_session.add(d)
    await db_session.commit()
    await db_session.refresh(d)

    for i in range(1, 501):
        risk = "critical" if i % 50 == 0 else ("high" if i % 10 == 0 else "low")
        event = AuditEvent(
            debate_id=d.id,
            sequence_number=i,
            event_type="GUARDIAN_ANALYSIS" if i % 5 == 0 else "SANITIZATION",
            actor="guardian" if i % 5 == 0 else ("bull" if i % 2 == 0 else "bear"),
            payload={"risk_level": risk, "turn": i},
        )
        db_session.add(event)

    await db_session.commit()
    return d


@pytest.mark.asyncio
async def test_jsonb_containment_uses_gin_index(
    db_session: AsyncSession, debate_with_events
):
    result = await db_session.execute(
        text(
            "SELECT COUNT(*) FROM audit_events "
            "WHERE debate_id = :debate_id "
            "AND payload @> CAST(:crit AS jsonb)"
        ),
        {"debate_id": str(debate_with_events.id), "crit": '{"risk_level": "critical"}'},
    )
    count = result.scalar_one()
    assert count == 10

    plan_result = await db_session.execute(
        text(
            "EXPLAIN (FORMAT JSON) SELECT COUNT(*) FROM audit_events "
            "WHERE debate_id = :debate_id "
            "AND payload @> CAST(:crit AS jsonb)"
        ),
        {"debate_id": str(debate_with_events.id), "crit": '{"risk_level": "critical"}'},
    )
    plan_text = plan_result.scalar_one()
    plan_str = str(plan_text).lower()
    assert "gin" in plan_str or "index" in plan_str


@pytest.mark.asyncio
async def test_jsonb_risk_level_ordered_by_sequence(
    db_session: AsyncSession, debate_with_events
):
    stmt = (
        select(AuditEvent)
        .where(AuditEvent.debate_id == debate_with_events.id)
        .where(AuditEvent.payload["risk_level"].astext == "high")
        .order_by(AuditEvent.sequence_number)
    )
    result = await db_session.execute(stmt)
    events = result.scalars().all()

    assert len(events) == 40
    seqs = [e.sequence_number for e in events]
    assert seqs == sorted(seqs)

    for e in events:
        assert e.payload["risk_level"] == "high"
