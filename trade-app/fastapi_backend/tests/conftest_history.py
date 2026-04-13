import pytest_asyncio
from datetime import datetime, timezone
from uuid import uuid4

from app.models import Debate, Vote


@pytest_asyncio.fixture(scope="function")
async def debate_batch(db_session):
    async def _create_batch(
        count: int = 5,
        asset: str = "bitcoin",
        status: str = "completed",
        vote_distribution: list[dict] | None = None,
    ) -> list[dict]:
        debates = []
        for i in range(count):
            ext_id = f"deb_hist_{uuid4().hex[:8]}"
            debate = Debate(
                external_id=ext_id,
                asset=asset,
                status=status,
                current_turn=6,
                max_turns=6,
                guardian_verdict="Caution",
                guardian_interrupts_count=0,
                created_at=datetime(2026, 1, i + 1, tzinfo=timezone.utc),
                completed_at=datetime(2026, 1, i + 1, 12, tzinfo=timezone.utc)
                if status == "completed"
                else None,
            )
            db_session.add(debate)
            await db_session.flush()

            dist = (
                vote_distribution[i]
                if vote_distribution and i < len(vote_distribution)
                else {}
            )
            for choice, num_votes in dist.items():
                for v in range(num_votes):
                    vote = Vote(
                        debate_id=debate.id,
                        choice=choice,
                        voter_fingerprint=f"fp_{uuid4().hex[:8]}",
                    )
                    db_session.add(vote)

            debates.append(
                {
                    "id": debate.id,
                    "external_id": ext_id,
                    "asset": asset,
                    "status": status,
                    "created_at": debate.created_at,
                    "completed_at": debate.completed_at,
                    "vote_distribution": dist,
                }
            )
        await db_session.commit()
        return debates

    return _create_batch


@pytest_asyncio.fixture(scope="function")
async def vote_factory(db_session):
    async def _add_votes(debate_id, distribution: dict[str, int]) -> None:
        for choice, count in distribution.items():
            for _ in range(count):
                vote = Vote(
                    debate_id=debate_id,
                    choice=choice,
                    voter_fingerprint=f"fp_{uuid4().hex[:8]}",
                )
                db_session.add(vote)
        await db_session.commit()

    return _add_votes
