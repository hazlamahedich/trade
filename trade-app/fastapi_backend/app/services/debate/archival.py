import asyncio
import json
import logging
from typing import Any

from sqlalchemy import select, func

from app.database import async_session_maker
from app.models import Vote
from app.services.debate.repository import DebateRepository
from app.services.debate.streaming import stream_state

logger = logging.getLogger(__name__)

MAX_TRANSCRIPT_BYTES = 500_000
MAX_ARCHIVE_RETRIES = 3
ARCHIVE_RETRY_DELAY_S = 1.0


async def archive_debate(debate_id: str, state: dict[str, Any] | None = None) -> None:
    if state is None:
        redis_state = await stream_state.get_state(debate_id)
        if redis_state is None:
            logger.info(f"No state found for debate {debate_id}, skipping archival")
            return
        state = redis_state

    async with async_session_maker() as session:
        repo = DebateRepository(session)

        debate = await repo.get_by_external_id_for_update(debate_id)
        if debate is None:
            logger.error(f"Debate {debate_id} not found in database during archival")
            return

        if debate.completed_at is not None:
            logger.info(f"Debate {debate_id} already archived")
            return

        vote_count_stmt = (
            select(Vote.choice, func.count(Vote.id))
            .where(Vote.debate_id == debate.id)
            .group_by(Vote.choice)
        )
        result = await session.execute(vote_count_stmt)
        counts: dict[str, int] = {row[0]: row[1] for row in result}
        vote_bull = counts.get("bull", 0)
        vote_bear = counts.get("bear", 0)
        vote_undecided = counts.get("undecided", 0)

        messages = state.get("messages", [])
        transcript = json.dumps(messages) if messages else json.dumps([])

        if len(transcript.encode("utf-8")) > MAX_TRANSCRIPT_BYTES:
            logger.warning(
                f"Transcript for debate {debate_id} exceeds {MAX_TRANSCRIPT_BYTES} bytes, "
                f"truncating to last 100 messages"
            )
            messages = messages[-100:]
            transcript = json.dumps(messages)

        guardian_verdict = state.get("guardian_verdict")
        interrupts = state.get("guardian_interrupts", [])
        guardian_interrupts_count = (
            len(interrupts) if isinstance(interrupts, list) else 0
        )
        current_turn = state.get("current_turn", 0)

        await repo.complete_debate(
            external_id=debate_id,
            guardian_verdict=guardian_verdict,
            guardian_interrupts_count=guardian_interrupts_count,
            transcript=transcript,
            current_turn=current_turn,
            vote_bull=vote_bull,
            vote_bear=vote_bear,
            vote_undecided=vote_undecided,
        )

        try:
            await stream_state.delete_state(debate_id)
        except Exception:
            logger.warning(
                f"Failed to delete Redis state for debate {debate_id}",
                exc_info=True,
            )

        logger.info(f"Debate {debate_id} archived successfully")


async def archive_with_retry(
    debate_id: str,
    state: dict[str, Any],
) -> bool:
    for attempt in range(1, MAX_ARCHIVE_RETRIES + 1):
        try:
            await archive_debate(debate_id, state)
            return True
        except Exception:
            logger.warning(
                f"Archive attempt {attempt}/{MAX_ARCHIVE_RETRIES} failed for {debate_id}",
                exc_info=True,
            )
            if attempt < MAX_ARCHIVE_RETRIES:
                await asyncio.sleep(ARCHIVE_RETRY_DELAY_S * attempt)
    logger.error(f"All {MAX_ARCHIVE_RETRIES} archive attempts failed for {debate_id}")
    return False
