import logging

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Debate, Vote
from app.services.debate.vote_schemas import (
    DebateResultResponse,
    VoteResponse,
)
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class DebateRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_external_id(self, external_id: str) -> Debate | None:
        stmt = select(Debate).where(Debate.external_id == external_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def save_debate(
        self,
        external_id: str,
        asset: str,
        status: str,
        current_turn: int,
        max_turns: int,
        guardian_verdict: str | None = None,
        guardian_interrupts_count: int = 0,
        transcript: str | None = None,
    ) -> Debate:
        debate = Debate(
            external_id=external_id,
            asset=asset,
            status=status,
            current_turn=current_turn,
            max_turns=max_turns,
            guardian_verdict=guardian_verdict,
            guardian_interrupts_count=guardian_interrupts_count,
            transcript=transcript,
        )
        self.session.add(debate)
        await self.session.commit()
        await self.session.refresh(debate)
        return debate

    async def complete_debate(
        self,
        external_id: str,
        guardian_verdict: str | None = None,
        guardian_interrupts_count: int = 0,
        transcript: str | None = None,
        current_turn: int = 0,
    ) -> Debate | None:
        debate = await self.get_by_external_id(external_id)
        if debate is None:
            return None
        debate.status = "completed"
        debate.completed_at = datetime.now(timezone.utc)
        debate.guardian_verdict = guardian_verdict
        debate.guardian_interrupts_count = guardian_interrupts_count
        debate.transcript = transcript
        debate.current_turn = current_turn
        await self.session.commit()
        await self.session.refresh(debate)
        return debate

    async def get_result(self, external_id: str) -> DebateResultResponse | None:
        debate = await self.get_by_external_id(external_id)
        if debate is None:
            return None

        vote_count_stmt = (
            select(Vote.choice, func.count(Vote.id))
            .where(Vote.debate_id == debate.id)
            .group_by(Vote.choice)
        )
        vote_result = await self.session.execute(vote_count_stmt)
        vote_breakdown = {row[0]: row[1] for row in vote_result}

        total_votes_stmt = select(func.count(Vote.id)).where(
            Vote.debate_id == debate.id
        )
        total_result = await self.session.execute(total_votes_stmt)
        total_votes = total_result.scalar() or 0

        return DebateResultResponse(
            debate_id=debate.external_id,
            asset=debate.asset,
            status=debate.status,
            current_turn=debate.current_turn,
            max_turns=debate.max_turns,
            guardian_verdict=debate.guardian_verdict,
            guardian_interrupts_count=debate.guardian_interrupts_count,
            created_at=debate.created_at,
            completed_at=debate.completed_at,
            total_votes=total_votes,
            vote_breakdown=vote_breakdown,
        )

    async def has_existing_vote(self, debate_id, voter_fingerprint: str) -> bool:
        existing_stmt = select(Vote).where(
            Vote.debate_id == debate_id,
            Vote.voter_fingerprint == voter_fingerprint,
        )
        existing = await self.session.execute(existing_stmt)
        return existing.scalar_one_or_none() is not None

    async def create_vote(
        self,
        debate_id,
        debate_external_id: str,
        choice: str,
        voter_fingerprint: str,
    ) -> VoteResponse:
        vote = Vote(
            debate_id=debate_id,
            choice=choice,
            voter_fingerprint=voter_fingerprint,
        )
        self.session.add(vote)
        await self.session.commit()
        await self.session.refresh(vote)

        return VoteResponse(
            vote_id=str(vote.id),
            debate_id=debate_external_id,
            choice=vote.choice,
            voter_fingerprint=vote.voter_fingerprint,
            created_at=vote.created_at,
        )

    async def cast_vote(
        self, debate_external_id: str, choice: str, voter_fingerprint: str
    ) -> VoteResponse | None:
        debate = await self.get_by_external_id(debate_external_id)
        if debate is None:
            return None

        existing_stmt = select(Vote).where(
            Vote.debate_id == debate.id,
            Vote.voter_fingerprint == voter_fingerprint,
        )
        existing = await self.session.execute(existing_stmt)
        if existing.scalar_one_or_none() is not None:
            return None

        vote = Vote(
            debate_id=debate.id,
            choice=choice,
            voter_fingerprint=voter_fingerprint,
        )
        self.session.add(vote)
        await self.session.commit()
        await self.session.refresh(vote)

        return VoteResponse(
            vote_id=str(vote.id),
            debate_id=debate.external_id,
            choice=vote.choice,
            voter_fingerprint=vote.voter_fingerprint,
            created_at=vote.created_at,
        )
