import logging

from fastapi import APIRouter
from pydantic import BaseModel
from redis import asyncio as aioredis
from sqlalchemy import text
from typing import Any

from app.config import settings
from app.database import engine

router = APIRouter(tags=["health"])

logger = logging.getLogger(__name__)


class HealthResponse(BaseModel):
    status: str
    database: str
    redis: str


class MetaResponse(BaseModel):
    version: str


class StandardResponse(BaseModel):
    data: HealthResponse
    error: Any
    meta: MetaResponse


async def check_database() -> str:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return "connected"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return "disconnected"


async def check_redis() -> str:
    try:
        redis_client = aioredis.from_url(
            settings.REDIS_URL, encoding="utf-8", decode_responses=True
        )
        await redis_client.ping()
        await redis_client.close()
        return "connected"
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return "disconnected"


@router.get("/api/health", response_model=StandardResponse)
async def health_check() -> StandardResponse:
    db_status = await check_database()
    redis_status = await check_redis()

    overall_status = (
        "healthy"
        if db_status == "connected" and redis_status == "connected"
        else "unhealthy"
    )

    return StandardResponse(
        data=HealthResponse(
            status=overall_status,
            database=db_status,
            redis=redis_status,
        ),
        error=None,
        meta=MetaResponse(version="1.0.0"),
    )
