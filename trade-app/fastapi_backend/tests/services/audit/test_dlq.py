import uuid
import pytest
from unittest.mock import AsyncMock

from app.models import AuditDLQ
from app.services.audit.dlq import list_dlq_entries, replay_dlq_entry


@pytest.mark.asyncio
async def test_dlq_write_on_third_retry_failure(db_session):
    dlq = AuditDLQ(
        original_event={"debate_id": str(uuid.uuid4()), "event_type": "TEST"},
        error_message="connection failed",
        retry_count=3,
    )
    db_session.add(dlq)
    await db_session.commit()

    entries = await list_dlq_entries(db_session)
    assert len(entries) >= 1
    assert entries[0].error_message == "connection failed"


@pytest.mark.asyncio
async def test_dlq_replay_increments_retry_count(db_session):
    dlq = AuditDLQ(
        original_event={
            "debate_id": str(uuid.uuid4()),
            "event_type": "TEST",
            "actor": "system",
            "payload": {},
        },
        error_message="fail",
        retry_count=0,
    )
    db_session.add(dlq)
    await db_session.commit()

    mock_writer = AsyncMock()
    mock_writer.write = AsyncMock(side_effect=Exception("still failing"))

    success, reason = await replay_dlq_entry(db_session, dlq.id, writer=mock_writer)
    assert success is False
    assert reason == "replay_failed"

    await db_session.refresh(dlq)
    assert dlq.retry_count == 1


@pytest.mark.asyncio
async def test_dlq_replay_skips_retry_count_gte_3(db_session):
    dlq = AuditDLQ(
        original_event={"debate_id": str(uuid.uuid4()), "event_type": "TEST"},
        error_message="permanent fail",
        retry_count=3,
    )
    db_session.add(dlq)
    await db_session.commit()

    mock_writer = AsyncMock()
    success, reason = await replay_dlq_entry(db_session, dlq.id, writer=mock_writer)
    assert success is False
    assert reason == "max_retries_exceeded"
    mock_writer.write.assert_not_called()


@pytest.mark.asyncio
async def test_dlq_replay_force_overrides_max_retries(db_session):
    dlq = AuditDLQ(
        original_event={
            "debate_id": str(uuid.uuid4()),
            "event_type": "TEST",
            "actor": "system",
            "payload": {},
        },
        error_message="permanent fail",
        retry_count=3,
    )
    db_session.add(dlq)
    await db_session.commit()

    mock_writer = AsyncMock()
    success, reason = await replay_dlq_entry(
        db_session, dlq.id, writer=mock_writer, force=True
    )
    assert success is True
    assert reason == "replayed"
    mock_writer.write.assert_called_once()


@pytest.mark.asyncio
async def test_dlq_replay_returns_not_found_for_missing(db_session):
    fake_id = uuid.uuid4()
    mock_writer = AsyncMock()
    success, reason = await replay_dlq_entry(db_session, fake_id, writer=mock_writer)
    assert success is False
    assert reason == "not_found"
