import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditDLQ
from app.services.audit.writer import DirectAuditWriter

logger = logging.getLogger(__name__)


async def list_dlq_entries(
    session: AsyncSession,
    limit: int = 50,
    offset: int = 0,
) -> list[AuditDLQ]:
    result = await session.execute(
        select(AuditDLQ)
        .order_by(AuditDLQ.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


async def replay_dlq_entry(
    session: AsyncSession,
    event_id: UUID,
    writer: DirectAuditWriter | None = None,
    force: bool = False,
) -> tuple[bool, str]:
    result = await session.execute(select(AuditDLQ).where(AuditDLQ.id == event_id))
    dlq_entry = result.scalar_one_or_none()
    if not dlq_entry:
        return False, "not_found"

    if dlq_entry.retry_count >= 3 and not force:
        return False, "max_retries_exceeded"

    writer = writer or DirectAuditWriter()
    try:
        event_data = dlq_entry.original_event
        await writer.write(event_data)
        await session.delete(dlq_entry)
        await session.commit()
        logger.info(f"DLQ entry {event_id} replayed successfully")
        return True, "replayed"
    except Exception as e:
        dlq_entry.retry_count += 1
        dlq_entry.error_message = str(e)
        await session.commit()
        logger.error(f"DLQ replay failed for {event_id}: {e}")
        return False, "replay_failed"
