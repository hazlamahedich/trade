import uuid

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditDLQ, Debate, HallucinationFlag


@pytest_asyncio.fixture
async def debate(db_session: AsyncSession):
    d = Debate(
        external_id=f"ext-{uuid.uuid4()}",
        asset="BTC",
        status="completed",
    )
    db_session.add(d)
    await db_session.commit()
    await db_session.refresh(d)
    return d


@pytest_asyncio.fixture
async def debate_eth(db_session: AsyncSession):
    d = Debate(
        external_id=f"ext-{uuid.uuid4()}",
        asset="ETH",
        status="completed",
    )
    db_session.add(d)
    await db_session.commit()
    await db_session.refresh(d)
    return d


@pytest_asyncio.fixture
async def debate_with_flag(db_session: AsyncSession, debate):
    flag = HallucinationFlag(
        debate_id=debate.id,
        turn=1,
        agent="bull",
        message_snippet="guaranteed 100% returns",
        status="pending",
    )
    db_session.add(flag)
    await db_session.commit()
    await db_session.refresh(flag)
    return debate, flag


@pytest_asyncio.fixture
async def debate_with_dismissed_flag(db_session: AsyncSession, debate):
    flag = HallucinationFlag(
        debate_id=debate.id,
        turn=1,
        agent="bull",
        message_snippet="test",
        status="dismissed",
    )
    db_session.add(flag)
    await db_session.commit()
    await db_session.refresh(flag)
    return debate, flag


@pytest_asyncio.fixture
async def dlq_entry(db_session: AsyncSession):
    dlq = AuditDLQ(
        original_event={
            "debate_id": str(uuid.uuid4()),
            "event_type": "TEST",
            "actor": "system",
            "payload": {},
        },
        error_message="connection failed",
        retry_count=0,
    )
    db_session.add(dlq)
    await db_session.commit()
    await db_session.refresh(dlq)
    return dlq


@pytest_asyncio.fixture
async def dlq_maxed_entry(db_session: AsyncSession):
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
    await db_session.refresh(dlq)
    return dlq
