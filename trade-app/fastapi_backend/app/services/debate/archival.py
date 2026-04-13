import json
import logging
from typing import Any

from sqlalchemy import select, func

from app.database import async_session_maker
from app.models import Vote
from app.services.debate.repository import DebateRepository
from app.services.debate.streaming import stream_state

logger = logging.getLogger(__name__)


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
        except Exception as e:
            logger.warning(f"Failed to delete Redis state for debate {debate_id}: {e}")

        logger.info(f"Debate {debate_id} archived successfully")
