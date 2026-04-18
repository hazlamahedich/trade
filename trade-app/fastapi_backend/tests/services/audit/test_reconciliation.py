import uuid
import pytest
from unittest.mock import AsyncMock, patch

from app.models import AuditDLQ, AuditEvent, Debate
from app.services.audit.reconciliation import (
    detect_gaps,
    reconcile_debate,
    replay_dlq_entries,
)


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
async def test_reconcile_debate_fills_gaps(db_session):
    debate_id = uuid.uuid4()
    debate = Debate(
        id=debate_id,
        external_id=f"ext-{debate_id}",
        asset="BTC",
        status="completed",
    )
    db_session.add(debate)

    for seq in [1, 2, 5]:
        event = AuditEvent(
            debate_id=debate_id,
            sequence_number=seq,
            event_type="GUARDIAN_ANALYSIS",
            actor="guardian",
            payload={"turn": seq},
        )
        db_session.add(event)
    await db_session.commit()

    with patch("app.services.audit.reconciliation.DirectAuditWriter") as MockWriter:
        mock_instance = AsyncMock()
        MockWriter.return_value = mock_instance

        filled = await reconcile_debate(db_session, debate_id)

    assert filled == 2
    assert mock_instance.write.call_count == 2
    calls = [c[0][0] for c in mock_instance.write.call_args_list]
    assert calls[0]["event_type"] == "RECONCILIATION_GAP_FILL"
    assert calls[0]["payload"]["gap_sequence_number"] == 3
    assert calls[1]["payload"]["gap_sequence_number"] == 4


@pytest.mark.asyncio
async def test_reconcile_debate_idempotent(db_session):
    debate_id = uuid.uuid4()
    debate = Debate(
        id=debate_id,
        external_id=f"ext-{debate_id}",
        asset="BTC",
        status="completed",
    )
    db_session.add(debate)

    event = AuditEvent(
        debate_id=debate_id,
        sequence_number=1,
        event_type="GUARDIAN_ANALYSIS",
        actor="guardian",
        payload={},
    )
    gap_fill = AuditEvent(
        debate_id=debate_id,
        sequence_number=2,
        event_type="RECONCILIATION_GAP_FILL",
        actor="system",
        payload={"gap_sequence_number": 2},
    )
    db_session.add_all([event, gap_fill])
    await db_session.commit()

    with patch("app.services.audit.reconciliation.DirectAuditWriter") as MockWriter:
        mock_instance = AsyncMock()
        MockWriter.return_value = mock_instance

        filled = await reconcile_debate(db_session, debate_id)

    assert filled == 0
    mock_instance.write.assert_not_called()


@pytest.mark.asyncio
async def test_reconcile_debate_no_gaps_returns_zero(db_session):
    debate_id = uuid.uuid4()
    debate = Debate(
        id=debate_id,
        external_id=f"ext-{debate_id}",
        asset="BTC",
        status="completed",
    )
    db_session.add(debate)

    for seq in [1, 2, 3]:
        event = AuditEvent(
            debate_id=debate_id,
            sequence_number=seq,
            event_type="GUARDIAN_ANALYSIS",
            actor="guardian",
            payload={},
        )
        db_session.add(event)
    await db_session.commit()

    with patch("app.services.audit.reconciliation.DirectAuditWriter") as MockWriter:
        mock_instance = AsyncMock()
        MockWriter.return_value = mock_instance

        filled = await reconcile_debate(db_session, debate_id)

    assert filled == 0


@pytest.mark.asyncio
async def test_replay_dlq_entries_successful(db_session):
    dlq = AuditDLQ(
        original_event={
            "debate_id": str(uuid.uuid4()),
            "event_type": "TEST",
            "actor": "system",
            "payload": {},
        },
        error_message="temp fail",
        retry_count=0,
    )
    db_session.add(dlq)
    await db_session.commit()

    with patch("app.services.audit.reconciliation.DirectAuditWriter") as MockWriter:
        mock_instance = AsyncMock()
        MockWriter.return_value = mock_instance

        replayed = await replay_dlq_entries(db_session)

    assert replayed == 1
    mock_instance.write.assert_called_once()


@pytest.mark.asyncio
async def test_replay_dlq_entries_skips_max_retries(db_session):
    dlq_ok = AuditDLQ(
        original_event={
            "debate_id": str(uuid.uuid4()),
            "event_type": "TEST",
            "actor": "system",
            "payload": {},
        },
        error_message="temp",
        retry_count=0,
    )
    dlq_maxed = AuditDLQ(
        original_event={
            "debate_id": str(uuid.uuid4()),
            "event_type": "TEST",
            "actor": "system",
            "payload": {},
        },
        error_message="permanent",
        retry_count=3,
    )
    db_session.add_all([dlq_ok, dlq_maxed])
    await db_session.commit()

    with patch("app.services.audit.reconciliation.DirectAuditWriter") as MockWriter:
        mock_instance = AsyncMock()
        MockWriter.return_value = mock_instance

        replayed = await replay_dlq_entries(db_session)

    assert replayed == 1


@pytest.mark.asyncio
async def test_replay_dlq_entries_increments_retry_on_failure(db_session):
    dlq = AuditDLQ(
        original_event={
            "debate_id": str(uuid.uuid4()),
            "event_type": "TEST",
            "actor": "system",
            "payload": {},
        },
        error_message="fail",
        retry_count=1,
    )
    db_session.add(dlq)
    await db_session.commit()

    with patch("app.services.audit.reconciliation.DirectAuditWriter") as MockWriter:
        mock_instance = AsyncMock()
        mock_instance.write = AsyncMock(side_effect=ConnectionError("still down"))
        MockWriter.return_value = mock_instance

        replayed = await replay_dlq_entries(db_session)

    assert replayed == 0
    await db_session.refresh(dlq)
    assert dlq.retry_count == 2


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
