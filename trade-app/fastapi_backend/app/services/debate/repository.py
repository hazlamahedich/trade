import json
import logging
from uuid import UUID

from sqlalchemy import select, func, case, literal
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Debate, Vote
from app.services.debate.vote_schemas import (
    DebateResultResponse,
    VoteResponse,
)
from app.services.debate.schemas import DebateHistoryItem
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def _build_winner_expr(bull_votes, bear_votes, undecided_votes):
    return case(
        (
            (bull_votes == 0) & (bear_votes == 0) & (undecided_votes == 0),
            literal("undecided"),
        ),
        (
            undecided_votes > bull_votes,
            case(
                (undecided_votes > bear_votes, literal("undecided")),
                else_=literal("bear"),
            ),
        ),
        (
            undecided_votes > bear_votes,
            literal("bull"),
        ),
        (
            bull_votes > bear_votes,
            literal("bull"),
        ),
        (
            bear_votes > bull_votes,
            literal("bear"),
        ),
        else_=literal("undecided"),
    )


class DebateRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_external_id(self, external_id: str) -> Debate | None:
        stmt = select(Debate).where(Debate.external_id == external_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_external_id_for_update(self, external_id: str) -> Debate | None:
        stmt = select(Debate).where(Debate.external_id == external_id).with_for_update()
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
        vote_bull: int | None = None,
        vote_bear: int | None = None,
        vote_undecided: int | None = None,
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
        if vote_bull is not None:
            debate.vote_bull = vote_bull
        if vote_bear is not None:
            debate.vote_bear = vote_bear
        if vote_undecided is not None:
            debate.vote_undecided = vote_undecided
        await self.session.commit()
        await self.session.refresh(debate)
        return debate

    async def get_result(
        self, external_id: str, include_transcript: bool = False
    ) -> DebateResultResponse | None:
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
        total_votes = sum(vote_breakdown.values())

        transcript = None
        if include_transcript and debate.transcript:
            try:
                raw: list[dict[str, str]] = json.loads(debate.transcript)
                transcript = [
                    {"role": msg["role"], "content": msg["content"]} for msg in raw
                ]
            except (json.JSONDecodeError, KeyError, TypeError):
                logger.warning(
                    "Failed to deserialize transcript for debate %s",
                    external_id,
                )
                transcript = None

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
            transcript=transcript,
        )

    async def has_existing_vote(self, debate_id: UUID, voter_fingerprint: str) -> bool:
        existing_stmt = select(Vote).where(
            Vote.debate_id == debate_id,
            Vote.voter_fingerprint == voter_fingerprint,
        )
        existing = await self.session.execute(existing_stmt)
        return existing.scalar_one_or_none() is not None

    async def create_vote(
        self,
        debate_id: UUID,
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

    async def get_filtered_debates(
        self,
        page: int = 1,
        size: int = 20,
        asset: str | None = None,
        outcome: str | None = None,
    ) -> tuple[list[DebateHistoryItem], int]:
        bull_votes = func.coalesce(
            func.count(Vote.id).filter(Vote.choice == "bull"), 0
        ).label("bull_votes")
        bear_votes = func.coalesce(
            func.count(Vote.id).filter(Vote.choice == "bear"), 0
        ).label("bear_votes")
        undecided_votes = func.coalesce(
            func.count(Vote.id).filter(Vote.choice == "undecided"), 0
        ).label("undecided_votes")

        winner_expr = _build_winner_expr(bull_votes, bear_votes, undecided_votes).label(
            "winner"
        )

        total_votes_expr = func.coalesce(func.count(Vote.id), 0).label("total_votes")

        base_where_conditions = [Debate.status == "completed"]
        if asset is not None:
            base_where_conditions.append(Debate.asset == asset)

        data_query = (
            select(
                Debate.external_id,
                Debate.asset,
                Debate.status,
                Debate.guardian_verdict,
                Debate.guardian_interrupts_count,
                total_votes_expr,
                bull_votes,
                bear_votes,
                undecided_votes,
                winner_expr,
                Debate.created_at,
                Debate.completed_at,
            )
            .select_from(Debate)
            .outerjoin(Vote, Vote.debate_id == Debate.id)
            .where(*base_where_conditions)
            .group_by(
                Debate.id,
                Debate.external_id,
                Debate.asset,
                Debate.status,
                Debate.guardian_verdict,
                Debate.guardian_interrupts_count,
                Debate.created_at,
                Debate.completed_at,
            )
        )

        if outcome is not None:
            data_query = data_query.having(winner_expr == outcome)
            count_winner = _build_winner_expr(
                bull_votes, bear_votes, undecided_votes
            ).label("winner")
            count_cte = select(func.count()).select_from(
                select(count_winner)
                .select_from(Debate)
                .outerjoin(Vote, Vote.debate_id == Debate.id)
                .where(*base_where_conditions)
                .group_by(Debate.id)
                .having(count_winner == outcome)
                .subquery()
            )
            count_result = await self.session.execute(count_cte)
            total = count_result.scalar() or 0
        else:
            count_stmt = select(func.count(Debate.id)).where(*base_where_conditions)
            count_result = await self.session.execute(count_stmt)
            total = count_result.scalar() or 0

        data_query = data_query.order_by(Debate.created_at.desc())
        offset = (page - 1) * size
        data_query = data_query.offset(offset).limit(size)

        result = await self.session.execute(data_query)
        rows = result.all()

        items: list[DebateHistoryItem] = []
        for row in rows:
            vote_breakdown = {
                "bull": row.bull_votes,
                "bear": row.bear_votes,
                "undecided": row.undecided_votes,
            }

            items.append(
                DebateHistoryItem(
                    external_id=row.external_id,
                    asset=row.asset,
                    status=row.status,
                    guardian_verdict=row.guardian_verdict,
                    guardian_interrupts_count=row.guardian_interrupts_count,
                    total_votes=row.total_votes,
                    vote_breakdown=vote_breakdown,
                    winner=row.winner,
                    created_at=row.created_at,
                    completed_at=row.completed_at,
                )
            )

        return items, total
