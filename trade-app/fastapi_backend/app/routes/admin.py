import logging
import time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from humps import camelize
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_session
from app.models import (
    AuditEvent,
    Debate,
    HallucinationFlag,
)
from app.services.audit.dlq import list_dlq_entries, replay_dlq_entry
from app.users import current_superuser

logger = logging.getLogger(__name__)

admin_router = APIRouter(
    prefix="/api/admin", tags=["admin"], dependencies=[Depends(current_superuser)]
)


def _camelize_alias(name: str) -> str:
    return camelize(name)


class AdminEnvelope(BaseModel):
    model_config = ConfigDict(
        alias_generator=_camelize_alias,
        populate_by_name=True,
    )


class AdminUserInfo(AdminEnvelope):
    id: str
    email: str
    is_superuser: bool


@admin_router.get("/me")
async def get_admin_info(user=Depends(current_superuser)):
    return {
        "data": AdminUserInfo(
            id=str(user.id),
            email=user.email,
            is_superuser=user.is_superuser,
        ),
        "error": None,
        "meta": {},
    }


# --- Schemas ---


SORT_BY_ALLOWLIST = {"created_at", "asset", "status", "external_id", "guardian_verdict"}


class AdminDebateItem(AdminEnvelope):
    id: str
    external_id: str
    asset: str
    status: str
    guardian_verdict: str | None = None
    created_at: str | None = None
    audit_event_count: int = 0
    risk_score: str | None = None


class AdminDebateListResponse(AdminEnvelope):
    debates: list[AdminDebateItem]
    total: int
    page: int
    page_size: int


class AdminAuditEventItem(AdminEnvelope):
    id: str
    debate_id: str
    sequence_number: int
    event_type: str
    actor: str
    payload: dict
    created_at: str | None = None


class AdminAuditEventListResponse(AdminEnvelope):
    events: list[AdminAuditEventItem]
    total: int
    page: int
    page_size: int


class AdminDebateDetail(AdminEnvelope):
    id: str
    external_id: str
    asset: str
    status: str
    guardian_verdict: str | None = None
    created_at: str | None = None


class AdminDebateDetailResponse(AdminEnvelope):
    debate: AdminDebateDetail
    audit_events: list[AdminAuditEventItem]


class HallucinationFlagCreate(AdminEnvelope):
    turn: int
    agent: str
    message_snippet: str
    notes: str | None = None


class HallucinationFlagUpdate(AdminEnvelope):
    status: str | None = None
    notes: str | None = None


class HallucinationFlagResponse(AdminEnvelope):
    id: str
    debate_id: str
    turn: int
    agent: str
    message_snippet: str
    status: str
    notes: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class HallucinationFlagListResponse(AdminEnvelope):
    flags: list[HallucinationFlagResponse]
    total: int
    page: int
    page_size: int


# --- Debate Endpoints ---


@admin_router.get("/debates")
async def list_debates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    status: str | None = Query(None),
    risk_level: str | None = Query(None),
    session: AsyncSession = Depends(get_async_session),
):
    start = time.monotonic()

    query = select(Debate)
    count_query = select(func.count()).select_from(Debate)

    if status:
        query = query.where(Debate.status == status)
        count_query = count_query.where(Debate.status == status)

    if sort_by not in SORT_BY_ALLOWLIST:
        sort_by = "created_at"
    sort_col = getattr(Debate, sort_by)
    if sort_order == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await session.execute(query)
    debates = result.scalars().all()

    items: list[AdminDebateItem] = []
    for d in debates:
        ae_count_result = await session.execute(
            select(func.count()).where(AuditEvent.debate_id == d.id)
        )
        ae_count = ae_count_result.scalar_one()

        risk_result = await session.execute(
            select(AuditEvent.payload["risk_level"].astext)
            .where(AuditEvent.debate_id == d.id)
            .where(AuditEvent.event_type == "GUARDIAN_ANALYSIS")
            .where(AuditEvent.payload["risk_level"].astext.in_(["high", "critical"]))
            .order_by(
                text(
                    "CASE WHEN payload->>'risk_level' = 'critical' THEN 0 "
                    "WHEN payload->>'risk_level' = 'high' THEN 1 ELSE 2 END"
                )
            )
            .limit(1)
        )
        risk_score = risk_result.scalar_one_or_none()

        items.append(
            AdminDebateItem(
                id=str(d.id),
                external_id=d.external_id,
                asset=d.asset,
                status=d.status,
                guardian_verdict=d.guardian_verdict,
                created_at=d.created_at.isoformat() if d.created_at else None,
                audit_event_count=ae_count,
                risk_score=risk_score,
            )
        )

    latency_ms = int((time.monotonic() - start) * 1000)
    return {
        "data": AdminDebateListResponse(
            debates=items,
            total=total,
            page=page,
            page_size=page_size,
        ),
        "error": None,
        "meta": {"latency_ms": latency_ms, "page": page, "total": total},
    }


@admin_router.get("/debates/{debate_id}/audit-events")
async def list_debate_audit_events(
    debate_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    event_type: str | None = Query(None),
    actor: str | None = Query(None),
    session: AsyncSession = Depends(get_async_session),
):
    start = time.monotonic()

    query = select(AuditEvent).where(AuditEvent.debate_id == debate_id)
    count_query = (
        select(func.count())
        .select_from(AuditEvent)
        .where(AuditEvent.debate_id == debate_id)
    )

    if event_type:
        query = query.where(AuditEvent.event_type == event_type)
        count_query = count_query.where(AuditEvent.event_type == event_type)
    if actor:
        query = query.where(AuditEvent.actor == actor)
        count_query = count_query.where(AuditEvent.actor == actor)

    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    query = query.order_by(AuditEvent.sequence_number.asc())
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await session.execute(query)
    events = result.scalars().all()

    items = [
        AdminAuditEventItem(
            id=str(e.id),
            debate_id=str(e.debate_id),
            sequence_number=e.sequence_number,
            event_type=e.event_type,
            actor=e.actor,
            payload=e.payload,
            created_at=e.created_at.isoformat() if e.created_at else None,
        )
        for e in events
    ]

    latency_ms = int((time.monotonic() - start) * 1000)
    return {
        "data": AdminAuditEventListResponse(
            events=items, total=total, page=page, page_size=page_size
        ),
        "error": None,
        "meta": {"latency_ms": latency_ms, "page": page, "total": total},
    }


@admin_router.get("/audit-events")
async def list_global_audit_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    event_type: str | None = Query(None),
    actor: str | None = Query(None),
    debate_id: UUID | None = Query(None),
    created_after: str | None = Query(None),
    created_before: str | None = Query(None),
    session: AsyncSession = Depends(get_async_session),
):
    start = time.monotonic()

    if created_after and created_before:
        from datetime import datetime

        try:
            after = datetime.fromisoformat(created_after)
            before = datetime.fromisoformat(created_before)
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail={
                    "data": None,
                    "error": {
                        "code": "INVALID_DATE_FORMAT",
                        "message": f"Invalid ISO date format: {exc}",
                    },
                    "meta": {},
                },
            )
        if after > before:
            raise HTTPException(
                status_code=400,
                detail={
                    "data": None,
                    "error": {
                        "code": "INVALID_RANGE",
                        "message": "created_after must be before created_before",
                    },
                    "meta": {},
                },
            )

    query = select(AuditEvent)
    count_query = select(func.count()).select_from(AuditEvent)

    if event_type:
        query = query.where(AuditEvent.event_type == event_type)
        count_query = count_query.where(AuditEvent.event_type == event_type)
    if actor:
        query = query.where(AuditEvent.actor == actor)
        count_query = count_query.where(AuditEvent.actor == actor)
    if debate_id:
        query = query.where(AuditEvent.debate_id == debate_id)
        count_query = count_query.where(AuditEvent.debate_id == debate_id)
    if created_after:
        query = query.where(AuditEvent.created_at >= created_after)
        count_query = count_query.where(AuditEvent.created_at >= created_after)
    if created_before:
        query = query.where(AuditEvent.created_at <= created_before)
        count_query = count_query.where(AuditEvent.created_at <= created_before)

    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    query = query.order_by(AuditEvent.created_at.desc())
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await session.execute(query)
    events = result.scalars().all()

    items = [
        AdminAuditEventItem(
            id=str(e.id),
            debate_id=str(e.debate_id),
            sequence_number=e.sequence_number,
            event_type=e.event_type,
            actor=e.actor,
            payload=e.payload,
            created_at=e.created_at.isoformat() if e.created_at else None,
        )
        for e in events
    ]

    latency_ms = int((time.monotonic() - start) * 1000)
    return {
        "data": AdminAuditEventListResponse(
            events=items, total=total, page=page, page_size=page_size
        ),
        "error": None,
        "meta": {"latency_ms": latency_ms, "page": page, "total": total},
    }


@admin_router.get("/debates/{debate_id}/detail")
async def get_debate_detail(
    debate_id: UUID,
    session: AsyncSession = Depends(get_async_session),
):
    start = time.monotonic()

    result = await session.execute(select(Debate).where(Debate.id == debate_id))
    debate = result.scalar_one_or_none()
    if not debate:
        raise HTTPException(status_code=404, detail="Debate not found")

    ae_result = await session.execute(
        select(AuditEvent)
        .where(AuditEvent.debate_id == debate_id)
        .order_by(AuditEvent.sequence_number.asc())
    )
    events = ae_result.scalars().all()

    detail = AdminDebateDetailResponse(
        debate=AdminDebateDetail(
            id=str(debate.id),
            external_id=debate.external_id,
            asset=debate.asset,
            status=debate.status,
            guardian_verdict=debate.guardian_verdict,
            created_at=debate.created_at.isoformat() if debate.created_at else None,
        ),
        audit_events=[
            AdminAuditEventItem(
                id=str(e.id),
                debate_id=str(e.debate_id),
                sequence_number=e.sequence_number,
                event_type=e.event_type,
                actor=e.actor,
                payload=e.payload,
                created_at=e.created_at.isoformat() if e.created_at else None,
            )
            for e in events
        ],
    )

    latency_ms = int((time.monotonic() - start) * 1000)
    return {
        "data": detail,
        "error": None,
        "meta": {"latency_ms": latency_ms},
    }


# --- DLQ Endpoints ---


@admin_router.get("/audit/dlq")
async def list_dlq(
    session: AsyncSession = Depends(get_async_session),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    start = time.monotonic()
    entries = await list_dlq_entries(session, limit=limit, offset=offset)
    latency_ms = int((time.monotonic() - start) * 1000)
    return {
        "data": [
            {
                "id": str(e.id),
                "original_event": e.original_event,
                "error_message": e.error_message,
                "retry_count": e.retry_count,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in entries
        ],
        "error": None,
        "meta": {"latency_ms": latency_ms},
    }


@admin_router.post("/audit/dlq/{event_id}/replay")
async def replay_dlq(
    event_id: UUID,
    force: bool = Query(False),
    session: AsyncSession = Depends(get_async_session),
):
    start = time.monotonic()
    success, reason = await replay_dlq_entry(session, event_id, force=force)
    if not success:
        if reason == "not_found":
            raise HTTPException(status_code=404, detail="DLQ entry not found")
        if reason == "max_retries_exceeded":
            raise HTTPException(
                status_code=409,
                detail="Max retries exceeded. Use force=true to override.",
            )
        raise HTTPException(status_code=400, detail="Replay failed")
    latency_ms = int((time.monotonic() - start) * 1000)
    return {
        "data": {"replayed": True, "event_id": str(event_id)},
        "error": None,
        "meta": {"latency_ms": latency_ms},
    }


# --- Hallucination Flags ---


@admin_router.post("/debates/{debate_id}/hallucination-flags")
async def create_hallucination_flag(
    debate_id: UUID,
    body: HallucinationFlagCreate,
    user=Depends(current_superuser),
    session: AsyncSession = Depends(get_async_session),
):
    start = time.monotonic()

    debate_result = await session.execute(select(Debate).where(Debate.id == debate_id))
    if not debate_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Debate not found")

    flag = HallucinationFlag(
        debate_id=debate_id,
        turn=body.turn,
        agent=body.agent,
        message_snippet=body.message_snippet,
        notes=body.notes,
        flagged_by=user.id,
    )
    session.add(flag)
    await session.commit()
    await session.refresh(flag)

    latency_ms = int((time.monotonic() - start) * 1000)
    return {
        "data": HallucinationFlagResponse(
            id=str(flag.id),
            debate_id=str(flag.debate_id),
            turn=flag.turn,
            agent=flag.agent,
            message_snippet=flag.message_snippet,
            status=flag.status,
            notes=flag.notes,
            created_at=flag.created_at.isoformat() if flag.created_at else None,
            updated_at=flag.updated_at.isoformat() if flag.updated_at else None,
        ),
        "error": None,
        "meta": {"latency_ms": latency_ms},
    }


@admin_router.get("/hallucination-flags")
async def list_hallucination_flags(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    session: AsyncSession = Depends(get_async_session),
):
    start = time.monotonic()

    query = select(HallucinationFlag)
    count_query = select(func.count()).select_from(HallucinationFlag)

    if status:
        query = query.where(HallucinationFlag.status == status)
        count_query = count_query.where(HallucinationFlag.status == status)

    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    query = query.order_by(HallucinationFlag.created_at.desc())
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await session.execute(query)
    flags = result.scalars().all()

    items = [
        HallucinationFlagResponse(
            id=str(f.id),
            debate_id=str(f.debate_id),
            turn=f.turn,
            agent=f.agent,
            message_snippet=f.message_snippet,
            status=f.status,
            notes=f.notes,
            created_at=f.created_at.isoformat() if f.created_at else None,
            updated_at=f.updated_at.isoformat() if f.updated_at else None,
        )
        for f in flags
    ]

    latency_ms = int((time.monotonic() - start) * 1000)
    return {
        "data": HallucinationFlagListResponse(
            flags=items, total=total, page=page, page_size=page_size
        ),
        "error": None,
        "meta": {"latency_ms": latency_ms, "page": page, "total": total},
    }


@admin_router.patch("/hallucination-flags/{flag_id}")
async def update_hallucination_flag(
    flag_id: UUID,
    body: HallucinationFlagUpdate,
    session: AsyncSession = Depends(get_async_session),
):
    start = time.monotonic()

    if body.status is None and body.notes is None:
        raise HTTPException(
            status_code=400,
            detail="At least one of 'status' or 'notes' must be provided",
        )

    result = await session.execute(
        select(HallucinationFlag).where(HallucinationFlag.id == flag_id)
    )
    flag = result.scalar_one_or_none()
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")

    valid_transitions = {
        "pending": ["confirmed", "dismissed"],
        "confirmed": ["dismissed"],
        "dismissed": [],
    }
    if body.status:
        allowed = valid_transitions.get(flag.status, [])
        if body.status not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition from '{flag.status}' to '{body.status}'",
            )
        flag.status = body.status
    if body.notes is not None:
        flag.notes = body.notes

    await session.commit()
    await session.refresh(flag)

    if flag.status == "confirmed":
        try:
            from app.services.audit.writer import get_audit_writer

            writer = get_audit_writer()
            await writer.write(
                {
                    "debate_id": str(flag.debate_id),
                    "event_type": "HALLUCINATION_FLAGGED",
                    "actor": "system",
                    "payload": {
                        "flag_id": str(flag.id),
                        "turn": flag.turn,
                        "agent": flag.agent,
                        "message_snippet": flag.message_snippet,
                    },
                }
            )
        except Exception:
            logger.warning(
                "Failed to write HALLUCINATION_FLAGGED audit event for flag %s",
                flag.id,
                exc_info=True,
            )

    latency_ms = int((time.monotonic() - start) * 1000)
    return {
        "data": HallucinationFlagResponse(
            id=str(flag.id),
            debate_id=str(flag.debate_id),
            turn=flag.turn,
            agent=flag.agent,
            message_snippet=flag.message_snippet,
            status=flag.status,
            notes=flag.notes,
            created_at=flag.created_at.isoformat() if flag.created_at else None,
            updated_at=flag.updated_at.isoformat() if flag.updated_at else None,
        ),
        "error": None,
        "meta": {"latency_ms": latency_ms},
    }
