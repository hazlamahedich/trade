import uuid
import pytest

from app.models import AuditEvent, Debate
from app.services.audit.reconciliation import detect_gaps


@pytest.mark.asyncio
async def test_reconciliation_detects_gap(db_session):
    debate_id = uuid.uuid4()
    debate = Debate(
        id=debate_id,
        external_id=f"ext-{debate_id}",
        asset="BTC",
        status="completed",
    )
    db_session.add(debate)
    await db_session.commit()

    for seq in [1, 2, 4, 5]:
        event = AuditEvent(
            debate_id=debate_id,
            sequence_number=seq,
            event_type="GUARDIAN_ANALYSIS",
            actor="guardian",
            payload={"turn": seq},
        )
        db_session.add(event)
    await db_session.commit()

    gaps = await detect_gaps(db_session, debate_id)
    assert gaps == [3]


@pytest.mark.asyncio
async def test_reconciliation_no_gaps_for_complete_sequence(db_session):
    debate_id = uuid.uuid4()
    debate = Debate(
        id=debate_id,
        external_id=f"ext-{debate_id}",
        asset="BTC",
        status="completed",
    )
    db_session.add(debate)
    await db_session.commit()

    for seq in [1, 2, 3, 4, 5]:
        event = AuditEvent(
            debate_id=debate_id,
            sequence_number=seq,
            event_type="GUARDIAN_ANALYSIS",
            actor="guardian",
            payload={},
        )
        db_session.add(event)
    await db_session.commit()

    gaps = await detect_gaps(db_session, debate_id)
    assert gaps == []


@pytest.mark.asyncio
async def test_reconciliation_handles_zero_events(db_session):
    debate_id = uuid.uuid4()
    gaps = await detect_gaps(db_session, debate_id)
    assert gaps == []


@pytest.mark.asyncio
async def test_reconciliation_skips_legacy_migration(db_session):
    debate_id = uuid.uuid4()
    debate = Debate(
        id=debate_id,
        external_id=f"ext-{debate_id}",
        asset="ETH",
        status="completed",
    )
    db_session.add(debate)
    await db_session.commit()

    event = AuditEvent(
        debate_id=debate_id,
        sequence_number=0,
        event_type="LEGACY_DEBATE_MIGRATION",
        actor="system",
        payload={"note": "pre-audit"},
    )
    db_session.add(event)
    await db_session.commit()

    gaps = await detect_gaps(db_session, debate_id)
    assert gaps == []
