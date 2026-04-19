import asyncio
import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditEvent, Debate
from app.services.audit.reconciliation import detect_gaps


@pytest_asyncio.fixture
async def debate(db_session: AsyncSession):
    d = Debate(
        external_id=f"ext-{uuid.uuid4()}",
        asset="BTC",
        status="completed",
    )
    db_session.add(d)
    await db_session.commit()
    await db_session.refresh(d)
    return d


@pytest_asyncio.fixture
async def debate_with_sequential_events(db_session: AsyncSession, debate):
    for seq in range(1, 6):
        event = AuditEvent(
            debate_id=debate.id,
            sequence_number=seq,
            event_type="GUARDIAN_ANALYSIS" if seq % 2 == 0 else "SANITIZATION",
            actor="guardian" if seq % 2 == 0 else "bull",
            payload={"turn": seq, "original": True},
        )
        db_session.add(event)
    await db_session.commit()
    return debate


@pytest.mark.asyncio
async def test_tamper_evidence_gap_detection_after_deletion(
    db_session: AsyncSession, debate_with_sequential_events
):
    debate_id = debate_with_sequential_events.id

    await db_session.execute(
        text("DELETE FROM audit_events WHERE debate_id = :did AND sequence_number = 3"),
        {"did": str(debate_id)},
    )
    await db_session.commit()

    gaps = await detect_gaps(db_session, debate_id)
    assert gaps == [3], f"Expected gap at sequence 3, got {gaps}"


@pytest.mark.asyncio
async def test_tamper_evidence_mutation_detected_via_payload_mismatch(
    db_session: AsyncSession, debate_with_sequential_events
):
    debate_id = debate_with_sequential_events.id

    original_result = await db_session.execute(
        select(AuditEvent).where(
            AuditEvent.debate_id == debate_id, AuditEvent.sequence_number == 2
        )
    )
    original_event = original_result.scalar_one()
    original_payload = dict(original_event.payload)

    await db_session.execute(
        text("UPDATE audit_events SET payload = :payload WHERE id = :eid"),
        {
            "payload": '{"turn": 2, "tampered": true}',
            "eid": str(original_event.id),
        },
    )
    await db_session.commit()

    mutated_result = await db_session.execute(
        text("SELECT payload FROM audit_events WHERE id = :eid"),
        {"eid": str(original_event.id)},
    )
    mutated_payload = mutated_result.scalar_one()

    assert mutated_payload != original_payload, (
        "Mutation of payload should be detectable by comparing snapshots"
    )
    assert mutated_payload.get("tampered") is True
    assert (
        "original" not in mutated_payload or mutated_payload.get("original") is not True
    )


@pytest.mark.asyncio
async def test_tamper_evidence_unique_constraint_prevents_insertion_attack(
    db_session: AsyncSession, debate
):
    await db_session.execute(
        text(
            "INSERT INTO audit_events (id, debate_id, sequence_number, event_type, actor, payload) "
            "VALUES (gen_random_uuid(), :did, 1, 'DEBATE_STARTED', 'system', '{}')"
        ),
        {"did": str(debate.id)},
    )
    await db_session.commit()

    with pytest.raises(Exception) as exc_info:
        await db_session.execute(
            text(
                "INSERT INTO audit_events (id, debate_id, sequence_number, event_type, actor, payload) "
                "VALUES (gen_random_uuid(), :did, 1, 'FAKE_EVENT', 'attacker', '{}')"
            ),
            {"did": str(debate.id)},
        )
        await db_session.commit()
    assert "unique" in str(exc_info.value).lower()
    await db_session.rollback()


@pytest.mark.asyncio
async def test_tamper_evidence_concurrent_writer_sequence_uniqueness(
    db_session: AsyncSession, debate, engine
):
    from sqlalchemy.ext.asyncio import async_sessionmaker

    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    from app.services.audit.writer import DirectAuditWriter

    writer = DirectAuditWriter(session_factory=session_factory)

    async def write_event(label: str, _seq_offset: int):
        await writer.write(
            {
                "debate_id": str(debate.id),
                "event_type": "CONCURRENT_TEST",
                "actor": label,
                "payload": {"writer": label},
            }
        )

    tasks = [write_event(f"writer_{i}", i) for i in range(5)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    errors = [r for r in results if isinstance(r, Exception)]
    assert len(errors) == 0, f"Concurrent writes failed: {errors}"

    stmt = (
        select(AuditEvent)
        .where(AuditEvent.debate_id == debate.id)
        .order_by(AuditEvent.sequence_number)
    )
    result = await db_session.execute(stmt)
    events = result.scalars().all()

    assert len(events) == 5
    seqs = [e.sequence_number for e in events]
    assert seqs == list(range(1, 6)), f"Expected [1..5], got {seqs}"

    unique_seqs = set(seqs)
    assert len(unique_seqs) == len(seqs), "Duplicate sequence numbers detected"
