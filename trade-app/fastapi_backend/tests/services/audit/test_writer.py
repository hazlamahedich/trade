import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.audit.writer import (
    DirectAuditWriter,
    _NullAuditWriter,
    QueuedAuditWriter,
    get_audit_writer,
)


@pytest.mark.asyncio
async def test_null_writer_does_nothing():
    writer = _NullAuditWriter()
    await writer.write({"debate_id": "test", "event_type": "TEST"})
    await writer.flush()
    await writer.close()


@pytest.mark.asyncio
async def test_direct_writer_write_batch_retries_on_failure():
    call_count = 0

    async def _flaky_write(event):
        nonlocal call_count
        call_count += 1
        if call_count <= 2:
            raise ConnectionError("DB down")
        return None

    writer = DirectAuditWriter(session_factory=MagicMock())
    writer.write = _flaky_write

    with patch("app.services.audit.writer.asyncio.sleep", new_callable=AsyncMock):
        await writer.write_batch(
            [{"debate_id": "test", "event_type": "TEST", "actor": "system"}]
        )
    assert call_count == 3


@pytest.mark.asyncio
async def test_direct_writer_write_batch_raises_after_3_retries():
    async def _always_fail(event):
        raise ConnectionError("DB down")

    writer = DirectAuditWriter(session_factory=MagicMock())
    writer.write = _always_fail

    with patch("app.services.audit.writer.asyncio.sleep", new_callable=AsyncMock):
        with pytest.raises(ConnectionError):
            await writer.write_batch(
                [{"debate_id": "test", "event_type": "TEST", "actor": "system"}]
            )


@pytest.mark.asyncio
async def test_queued_writer_consumer_with_start():
    mock_direct = AsyncMock()
    writer = QueuedAuditWriter(direct_writer=mock_direct)
    await writer.start()

    await writer.write(
        {"debate_id": "test", "event_type": "TEST", "actor": "system", "payload": {}}
    )

    await writer.flush()
    await writer.close()

    mock_direct.write.assert_called_once()


@pytest.mark.asyncio
async def test_queued_writer_close_drains_remaining():
    mock_direct = AsyncMock()
    writer = QueuedAuditWriter(direct_writer=mock_direct)

    for i in range(3):
        writer._queue.put_nowait(
            {
                "debate_id": f"drain-{i}",
                "event_type": "TEST",
                "actor": "system",
                "payload": {},
            }
        )

    await writer.close()

    assert mock_direct.write.call_count == 3


@pytest.mark.asyncio
async def test_queued_writer_sends_to_dlq_after_retries():
    mock_direct = AsyncMock()
    mock_direct.write = AsyncMock(side_effect=ConnectionError("DB down"))

    mock_session = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_direct._session_factory = MagicMock()
    mock_direct._session_factory.return_value.__aenter__ = AsyncMock(
        return_value=mock_session
    )
    mock_direct._session_factory.return_value.__aexit__ = AsyncMock(return_value=False)

    writer = QueuedAuditWriter(direct_writer=mock_direct)
    batch = [
        {"debate_id": "fail", "event_type": "TEST", "actor": "system", "payload": {}}
    ]
    with patch("app.services.audit.writer.asyncio.sleep", new_callable=AsyncMock):
        await writer._write_batch(batch)

    mock_session.add.assert_called_once()
    mock_session.commit.assert_called_once()


@pytest.fixture
def reset_writer_global():
    import app.services.audit.writer as writer_mod

    original = writer_mod._writer_instance
    yield
    writer_mod._writer_instance = original


@pytest.mark.asyncio
async def test_get_audit_writer_returns_null_when_disabled():
    with patch("app.services.audit.writer.settings") as mock_settings:
        mock_settings.AUDIT_ENABLED = False
        writer = get_audit_writer()
        assert isinstance(writer, _NullAuditWriter)


@pytest.mark.asyncio
async def test_get_audit_writer_returns_queued_when_enabled(reset_writer_global):
    import app.services.audit.writer as writer_mod

    writer_mod._writer_instance = None
    with patch("app.services.audit.writer.settings") as mock_settings:
        mock_settings.AUDIT_ENABLED = True
        mock_settings.DATABASE_URL = "postgresql+asyncpg://test:test@localhost/test"
        writer = get_audit_writer()
        assert isinstance(writer, QueuedAuditWriter)
        await writer.close()


@pytest.mark.asyncio
async def test_queued_writer_enqueues_event():
    mock_direct = AsyncMock()
    writer = QueuedAuditWriter(direct_writer=mock_direct)
    event = {
        "debate_id": "test",
        "event_type": "TEST",
        "actor": "system",
        "payload": {},
    }
    await writer.write(event)
    assert writer._queue.qsize() == 1
    await writer.close()


@pytest.mark.asyncio
async def test_queued_writer_dlq_on_queue_full():
    mock_direct = AsyncMock()
    writer = QueuedAuditWriter(direct_writer=mock_direct)

    for i in range(1000):
        writer._queue.put_nowait({"debate_id": f"fill-{i}", "event_type": "TEST"})

    mock_session = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_direct._session_factory = MagicMock()
    mock_direct._session_factory.return_value.__aenter__ = AsyncMock(
        return_value=mock_session
    )
    mock_direct._session_factory.return_value.__aexit__ = AsyncMock(return_value=False)

    await writer.write(
        {
            "debate_id": "overflow",
            "event_type": "TEST",
            "actor": "system",
            "payload": {},
        }
    )

    await writer.close()
