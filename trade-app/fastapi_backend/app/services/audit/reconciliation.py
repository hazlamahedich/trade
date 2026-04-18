import asyncio
import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import AuditDLQ, AuditEvent, Debate
from app.services.audit.writer import DirectAuditWriter

logger = logging.getLogger(__name__)


async def detect_gaps(session: AsyncSession, debate_id: UUID) -> list[int]:
    result = await session.execute(
        select(AuditEvent.sequence_number)
        .where(AuditEvent.debate_id == debate_id)
        .where(AuditEvent.event_type != "LEGACY_DEBATE_MIGRATION")
        .where(AuditEvent.event_type != "RECONCILIATION_GAP_FILL")
        .order_by(AuditEvent.sequence_number)
    )
    seqs = [row[0] for row in result.all()]

    if not seqs:
        return []

    if seqs == [0]:
        return []

    max_seq = max(seqs)
    seq_set = set(seqs)
    expected = set(range(1, max_seq + 1))
    gaps = sorted(expected - seq_set)
    return gaps


async def reconcile_debate(session: AsyncSession, debate_id: UUID) -> int:
    existing = await session.execute(
        select(AuditEvent.sequence_number)
        .where(AuditEvent.debate_id == debate_id)
        .where(AuditEvent.event_type == "RECONCILIATION_GAP_FILL")
    )
    already_filled = {row[0] for row in existing.all()}

    gaps = await detect_gaps(session, debate_id)
    unfilled = [g for g in gaps if g not in already_filled]

    if not unfilled:
        return 0

    writer = DirectAuditWriter()
    for gap_seq in unfilled:
        await writer.write(
            {
                "debate_id": str(debate_id),
                "event_type": "RECONCILIATION_GAP_FILL",
                "actor": "system",
                "payload": {
                    "gap_sequence_number": gap_seq,
                    "note": "reconciliation auto-fill",
                },
            }
        )
    logger.info(f"Reconciliation filled {len(unfilled)} gaps for debate {debate_id}")
    return len(unfilled)


async def replay_dlq_entries(session: AsyncSession) -> int:
    result = await session.execute(select(AuditDLQ).where(AuditDLQ.retry_count < 3))
    entries = list(result.scalars().all())
    replayed = 0
    writer = DirectAuditWriter()

    for entry in entries:
        try:
            await writer.write(entry.original_event)
            await session.delete(entry)
            await session.flush()
            replayed += 1
        except Exception as e:
            entry.retry_count += 1
            entry.error_message = str(e)
            logger.warning(f"DLQ replay failed for {entry.id}: {e}")

    await session.commit()
    return replayed


async def run_reconciliation_loop() -> None:
    interval = settings.AUDIT_RECONCILIATION_INTERVAL_SECONDS
    logger.info(f"Audit reconciliation loop started (interval={interval}s)")

    while True:
        try:
            await asyncio.sleep(interval)
            if not settings.AUDIT_ENABLED:
                continue

            from app.database import async_session_maker

            async with async_session_maker() as session:
                result = await session.execute(
                    select(Debate.id).where(Debate.status == "completed")
                )
                debate_ids = [row[0] for row in result.all()]

                total_gaps = 0
                for did in debate_ids:
                    total_gaps += await reconcile_debate(session, did)

                replayed = await replay_dlq_entries(session)

                if total_gaps or replayed:
                    logger.info(
                        f"Reconciliation: filled {total_gaps} gaps, "
                        f"replayed {replayed} DLQ entries"
                    )
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"Reconciliation loop error: {e}")
