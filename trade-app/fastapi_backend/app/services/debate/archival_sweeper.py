import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select

from app.database import async_session_maker
from app.models import PendingArchive
from app.services.debate.archival import archive_debate
from app.services.debate.repository import DebateRepository

logger = logging.getLogger(__name__)

SWEEPER_BATCH_SIZE = 50
SWEEPER_INTERVAL_S = 60
MAX_BACKOFF_S = 3600


async def retry_pending_archives() -> int:
    async with async_session_maker() as session:
        stmt = (
            select(PendingArchive)
            .where(PendingArchive.next_attempt_at <= datetime.now(timezone.utc))
            .where(PendingArchive.resolved_at.is_(None))
            .where(PendingArchive.attempt_count < PendingArchive.max_attempts)
            .limit(SWEEPER_BATCH_SIZE)
        )
        result = await session.execute(stmt)
        records = result.scalars().all()

        if not records:
            return 0

        resolved = 0
        for record in records:
            try:
                state = (
                    record.full_state
                    if isinstance(record.full_state, dict)
                    else json.loads(record.full_state)
                )
                repo = DebateRepository(session)
                debate = await repo.get_by_external_id_for_update(
                    record.debate_external_id
                )
                if debate is None or debate.completed_at is not None:
                    record.resolved_at = datetime.now(timezone.utc)
                    resolved += 1
                    continue

                await archive_debate(record.debate_external_id, state)
                record.resolved_at = datetime.now(timezone.utc)
                resolved += 1
            except Exception as e:
                record.attempt_count += 1
                record.last_error = str(e)
                backoff = min(
                    SWEEPER_INTERVAL_S * (2**record.attempt_count), MAX_BACKOFF_S
                )
                record.next_attempt_at = datetime.now(timezone.utc) + timedelta(
                    seconds=backoff
                )
                logger.warning(
                    f"Pending archive retry {record.attempt_count} failed for "
                    f"{record.debate_external_id}: {e}"
                )

        await session.commit()
        return resolved


async def store_pending_archive(debate_id: str, state: dict[str, Any]) -> bool:
    try:
        async with async_session_maker() as session:
            existing = await session.execute(
                select(PendingArchive).where(
                    PendingArchive.debate_external_id == debate_id
                )
            )
            existing_record = existing.scalar_one_or_none()

            if existing_record is not None:
                existing_record.full_state = state
                existing_record.attempt_count += 1
                existing_record.next_attempt_at = datetime.now(timezone.utc)
            else:
                pending = PendingArchive(
                    debate_external_id=debate_id,
                    full_state=state,
                )
                session.add(pending)

            await session.commit()
        return True
    except Exception as e:
        logger.critical(
            f"Failed to store pending archive for {debate_id}: {e}",
            exc_info=True,
        )
        return False


async def sweep_loop() -> None:
    while True:
        try:
            count = await retry_pending_archives()
            if count > 0:
                logger.info(f"Pending archive sweeper resolved {count} records")
        except Exception as e:
            logger.error(f"Pending archive sweeper error: {e}", exc_info=True)
        await asyncio.sleep(SWEEPER_INTERVAL_S)
