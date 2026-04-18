import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.audit.writer import (
    DirectAuditWriter,
    _NullAuditWriter,
    QueuedAuditWriter,
)


@pytest.mark.asyncio
async def test_null_writer_does_nothing():
    writer = _NullAuditWriter()
    await writer.write({"debate_id": "test", "event_type": "TEST"})
    await writer.flush()
    await writer.close()


@pytest.mark.asyncio
async def test_direct_writer_raises_on_missing_debate_id():
    writer = DirectAuditWriter(session_factory=MagicMock())
    with pytest.raises(ValueError, match="debate_id"):
        await writer.write({"event_type": "TEST"})


@pytest.mark.asyncio
async def test_direct_writer_raises_on_missing_event_type():
    writer = DirectAuditWriter(session_factory=MagicMock())
    with pytest.raises(ValueError, match="event_type"):
        await writer.write({"debate_id": "test"})


@pytest.mark.asyncio
async def test_direct_writer_writes_with_correct_fields():
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one.return_value = 1
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock()

    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
    mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

    writer = DirectAuditWriter(session_factory=mock_factory)
    await writer.write(
        {
            "debate_id": "test-debate-id",
            "event_type": "SANITIZATION",
            "actor": "bull",
            "payload": {"redacted_phrases": ["guaranteed"]},
        }
    )

    mock_session.execute.assert_called_once()
    call_args = mock_session.execute.call_args
    params = call_args[0][1]
    assert params["debate_id"] == "test-debate-id"
    assert params["event_type"] == "SANITIZATION"
    assert params["actor"] == "bull"
    assert params["payload"] == {"redacted_phrases": ["guaranteed"]}


@pytest.mark.asyncio
async def test_direct_writer_payload_defaults_to_empty_dict():
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one.return_value = 1
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.commit = AsyncMock()

    mock_factory = MagicMock()
    mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_session)
    mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)

    writer = DirectAuditWriter(session_factory=mock_factory)
    await writer.write({"debate_id": "test", "event_type": "TEST", "actor": "system"})

    params = mock_session.execute.call_args[0][1]
    assert params["payload"] == {}


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
