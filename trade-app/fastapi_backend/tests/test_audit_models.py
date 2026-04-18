import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditDLQ, AuditEvent, Debate, HallucinationFlag


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


@pytest.mark.asyncio
async def test_audit_event_crud(db_session: AsyncSession, debate):
    result = await db_session.execute(
        text(
            "INSERT INTO audit_events (id, debate_id, sequence_number, event_type, actor, payload) "
            "VALUES (gen_random_uuid(), :debate_id, "
            "(SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM audit_events WHERE debate_id = :debate_id), "
            ":event_type, :actor, :payload) "
            "RETURNING sequence_number"
        ),
        {
            "debate_id": str(debate.id),
            "event_type": "DEBATE_STARTED",
            "actor": "system",
            "payload": '{"note": "test"}',
        },
    )
    seq = result.scalar_one()
    assert seq == 1
    await db_session.commit()

    stmt = select(AuditEvent).where(AuditEvent.debate_id == debate.id)
    result = await db_session.execute(stmt)
    event = result.scalar_one()
    assert event.event_type == "DEBATE_STARTED"
    assert event.actor == "system"
    assert event.sequence_number == 1
    assert event.payload == {"note": "test"}


@pytest.mark.asyncio
async def test_audit_event_sequence_increments(db_session: AsyncSession, debate):
    for i, (etype, actor) in enumerate(
        [
            ("DEBATE_STARTED", "system"),
            ("SANITIZATION", "bull"),
            ("GUARDIAN_ANALYSIS", "guardian"),
        ]
    ):
        await db_session.execute(
            text(
                "INSERT INTO audit_events (id, debate_id, sequence_number, event_type, actor, payload) "
                "VALUES (gen_random_uuid(), :debate_id, "
                "(SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM audit_events WHERE debate_id = :debate_id), "
                ":event_type, :actor, :payload) "
                "RETURNING sequence_number"
            ),
            {
                "debate_id": str(debate.id),
                "event_type": etype,
                "actor": actor,
                "payload": "{}",
            },
        )
        await db_session.commit()

    stmt = (
        select(AuditEvent)
        .where(AuditEvent.debate_id == debate.id)
        .order_by(AuditEvent.sequence_number)
    )
    result = await db_session.execute(stmt)
    events = result.scalars().all()
    assert len(events) == 3
    assert [e.sequence_number for e in events] == [1, 2, 3]


@pytest.mark.asyncio
async def test_unique_debate_sequence_constraint(db_session: AsyncSession, debate):
    await db_session.execute(
        text(
            "INSERT INTO audit_events (id, debate_id, sequence_number, event_type, actor, payload) "
            "VALUES (gen_random_uuid(), :debate_id, 1, 'DEBATE_STARTED', 'system', '{}')"
        ),
        {"debate_id": str(debate.id)},
    )
    await db_session.commit()

    with pytest.raises(Exception) as exc_info:
        await db_session.execute(
            text(
                "INSERT INTO audit_events (id, debate_id, sequence_number, event_type, actor, payload) "
                "VALUES (gen_random_uuid(), :debate_id, 1, 'DEBATE_STARTED', 'system', '{}')"
            ),
            {"debate_id": str(debate.id)},
        )
        await db_session.commit()
    assert (
        "uq_audit_events_debate_seq" in str(exc_info.value).lower()
        or "unique" in str(exc_info.value).lower()
    )
    await db_session.rollback()


@pytest.mark.asyncio
async def test_cascade_delete_debate_removes_audit_events(
    db_session: AsyncSession, debate
):
    await db_session.execute(
        text(
            "INSERT INTO audit_events (id, debate_id, sequence_number, event_type, actor, payload) "
            "VALUES (gen_random_uuid(), :debate_id, 1, 'DEBATE_STARTED', 'system', '{}')"
        ),
        {"debate_id": str(debate.id)},
    )
    await db_session.commit()

    await db_session.delete(debate)
    await db_session.commit()

    stmt = select(AuditEvent).where(AuditEvent.debate_id == debate.id)
    result = await db_session.execute(stmt)
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_hallucination_flag_crud(db_session: AsyncSession, debate):
    flag = HallucinationFlag(
        debate_id=debate.id,
        turn=2,
        agent="bull",
        message_snippet="guaranteed returns",
        status="pending",
    )
    db_session.add(flag)
    await db_session.commit()
    await db_session.refresh(flag)

    assert flag.id is not None
    assert flag.status == "pending"
    assert flag.debate_id == debate.id

    flag.status = "confirmed"
    flag.notes = "verified hallucination"
    await db_session.commit()
    await db_session.refresh(flag)
    assert flag.status == "confirmed"
    assert flag.notes == "verified hallucination"


@pytest.mark.asyncio
async def test_cascade_delete_debate_removes_hallucination_flags(
    db_session: AsyncSession, debate
):
    flag = HallucinationFlag(
        debate_id=debate.id,
        turn=1,
        agent="bear",
        message_snippet="will crash",
        status="pending",
    )
    db_session.add(flag)
    await db_session.commit()

    await db_session.delete(debate)
    await db_session.commit()

    stmt = select(HallucinationFlag).where(HallucinationFlag.debate_id == debate.id)
    result = await db_session.execute(stmt)
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_audit_dlq_crud(db_session: AsyncSession):
    dlq = AuditDLQ(
        original_event={"debate_id": str(uuid.uuid4()), "event_type": "TEST"},
        error_message="connection refused",
        retry_count=0,
    )
    db_session.add(dlq)
    await db_session.commit()
    await db_session.refresh(dlq)

    assert dlq.id is not None
    assert dlq.retry_count == 0
    assert dlq.original_event["event_type"] == "TEST"

    dlq.retry_count += 1
    await db_session.commit()
    await db_session.refresh(dlq)
    assert dlq.retry_count == 1


@pytest.mark.asyncio
async def test_config_audit_enabled_defaults_false(monkeypatch):
    from app.config import Settings

    env_vars = {
        "DATABASE_URL": "postgresql://test",
        "GOOGLE_API_KEY": "test",
        "REDIS_URL": "redis://localhost:6379/0",
        "ACCESS_SECRET_KEY": "test",
        "RESET_PASSWORD_SECRET_KEY": "test",
        "VERIFICATION_SECRET_KEY": "test",
    }
    for key, val in env_vars.items():
        monkeypatch.setenv(key, val)

    s = Settings()
    assert s.AUDIT_ENABLED is False


@pytest.mark.asyncio
async def test_audit_event_payload_defaults_to_empty_dict(
    db_session: AsyncSession, debate
):
    event = AuditEvent(
        debate_id=debate.id,
        sequence_number=1,
        event_type="DEBATE_STARTED",
        actor="system",
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)
    assert event.payload == {}
