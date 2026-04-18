import asyncio
import logging
from typing import Any, Protocol, runtime_checkable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models import AuditDLQ

logger = logging.getLogger(__name__)

_BATCH_SIZE = 50
_MAX_RETRIES = 3
_RETRY_BACKOFF_BASE = 0.5


@runtime_checkable
class AuditWriter(Protocol):
    async def write(self, event: dict[str, Any]) -> None: ...
    async def flush(self) -> None: ...
    async def close(self) -> None: ...


_shared_engine = None


def _get_shared_session_factory() -> async_sessionmaker[AsyncSession]:
    global _shared_engine
    from urllib.parse import urlparse

    parsed = urlparse(settings.DATABASE_URL)
    url = (
        f"postgresql+asyncpg://{parsed.username}:{parsed.password}@"
        f"{parsed.hostname}{':' + str(parsed.port) if parsed.port else ''}"
        f"{parsed.path}"
    )
    if _shared_engine is None:
        _shared_engine = create_async_engine(url)
    return async_sessionmaker(_shared_engine, expire_on_commit=False)


class DirectAuditWriter:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession] | None = None,
    ) -> None:
        self._session_factory = session_factory or _get_shared_session_factory()

    async def write(self, event: dict[str, Any]) -> None:
        debate_id = event.get("debate_id")
        event_type = event.get("event_type")
        if not debate_id or not event_type:
            raise ValueError("audit event requires debate_id and event_type")

        async with self._session_factory() as session:
            result = await session.execute(
                text(
                    "INSERT INTO audit_events (id, debate_id, sequence_number, event_type, actor, payload) "
                    "VALUES (gen_random_uuid(), :debate_id, "
                    "(SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM audit_events WHERE debate_id = :debate_id), "
                    ":event_type, :actor, :payload) "
                    "RETURNING sequence_number"
                ),
                {
                    "debate_id": str(debate_id),
                    "event_type": event_type,
                    "actor": event.get("actor", "system"),
                    "payload": event.get("payload", {}),
                },
            )
            seq = result.scalar_one()
            await session.commit()
            logger.debug(
                f"Audit event written: debate={debate_id} seq={seq} type={event_type}"
            )

    async def write_batch(self, events: list[dict[str, Any]]) -> None:
        for event in events:
            for attempt in range(_MAX_RETRIES):
                try:
                    await self.write(event)
                    break
                except Exception:
                    if attempt == _MAX_RETRIES - 1:
                        raise
                    backoff = _RETRY_BACKOFF_BASE * (2**attempt)
                    await asyncio.sleep(backoff)

    async def flush(self) -> None:
        pass

    async def close(self) -> None:
        pass


class QueuedAuditWriter:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession] | None = None,
        direct_writer: DirectAuditWriter | None = None,
    ) -> None:
        self._queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=1000)
        self._direct_writer = direct_writer or DirectAuditWriter(session_factory)
        self._consumer_task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        self._running = True
        self._consumer_task = asyncio.create_task(self._consumer_loop())
        logger.info("QueuedAuditWriter consumer started")

    async def write(self, event: dict[str, Any]) -> None:
        try:
            self._queue.put_nowait(event)
        except asyncio.QueueFull:
            logger.warning("Audit queue full, falling through to DLQ")
            await self._send_to_dlq(event, "queue_full")

    async def flush(self) -> None:
        batch: list[dict[str, Any]] = []
        while not self._queue.empty():
            try:
                batch.append(self._queue.get_nowait())
            except asyncio.QueueEmpty:
                break
        if batch:
            await self._write_batch(batch)

    async def close(self) -> None:
        self._running = False
        if self._consumer_task:
            self._consumer_task.cancel()
            try:
                await self._consumer_task
            except asyncio.CancelledError:
                pass

        remaining = self._queue.qsize()
        if remaining > 0:
            logger.info(f"Draining {remaining} audit events from queue")
            await self.flush()
        logger.info("QueuedAuditWriter closed")

    async def _consumer_loop(self) -> None:
        batch: list[dict[str, Any]] = []
        while self._running:
            try:
                event = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                batch.append(event)
                if len(batch) >= _BATCH_SIZE:
                    await self._write_batch(batch)
                    batch = []
            except asyncio.TimeoutError:
                if batch:
                    await self._write_batch(batch)
                    batch = []
            except asyncio.CancelledError:
                if batch:
                    await self._write_batch(batch)
                raise

    async def _write_batch(self, batch: list[dict[str, Any]]) -> None:
        for event in batch:
            for attempt in range(_MAX_RETRIES):
                try:
                    await self._direct_writer.write(event)
                    break
                except Exception as e:
                    if attempt == _MAX_RETRIES - 1:
                        logger.error(
                            f"Audit write failed after {_MAX_RETRIES} retries: {e}"
                        )
                        await self._send_to_dlq(event, str(e))
                    else:
                        backoff = _RETRY_BACKOFF_BASE * (2**attempt)
                        await asyncio.sleep(backoff)

    async def _send_to_dlq(self, event: dict[str, Any], error: str) -> None:
        try:
            async with self._direct_writer._session_factory() as session:
                dlq_entry = AuditDLQ(
                    original_event=event,
                    error_message=error,
                    retry_count=0,
                )
                session.add(dlq_entry)
                await session.commit()
                logger.info(f"Event sent to DLQ: {error}")
        except Exception as e:
            logger.critical(f"Failed to write to DLQ: {e}")


_writer_instance: QueuedAuditWriter | None = None


def get_audit_writer() -> AuditWriter:
    global _writer_instance
    if not settings.AUDIT_ENABLED:
        return _NullAuditWriter()
    if _writer_instance is None:
        _writer_instance = QueuedAuditWriter()
    return _writer_instance


class _NullAuditWriter:
    async def write(self, event: dict[str, Any]) -> None:
        pass

    async def flush(self) -> None:
        pass

    async def close(self) -> None:
        pass
