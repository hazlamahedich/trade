import pytest
from unittest.mock import AsyncMock

from app.services.debate.streaming import DebateConnectionManager


class TestDebateConnectionManagerAdvanced:
    @pytest.fixture
    def manager(self):
        return DebateConnectionManager()

    @pytest.fixture
    def mock_ws_1(self):
        ws = AsyncMock()
        ws.send_json = AsyncMock()
        ws.close = AsyncMock()
        return ws

    @pytest.fixture
    def mock_ws_2(self):
        ws = AsyncMock()
        ws.send_json = AsyncMock()
        ws.close = AsyncMock()
        return ws

    @pytest.mark.asyncio
    async def test_get_connection_count_returns_zero_when_empty(self, manager):
        count = manager.get_connection_count("debate-1")
        assert count == 0

    @pytest.mark.asyncio
    async def test_get_connection_count_returns_correct_count(
        self, manager, mock_ws_1, mock_ws_2
    ):
        await manager.connect("debate-1", mock_ws_1)
        await manager.connect("debate-1", mock_ws_2)

        assert manager.get_connection_count("debate-1") == 2

    @pytest.mark.asyncio
    async def test_get_connection_count_after_disconnect(
        self, manager, mock_ws_1, mock_ws_2
    ):
        await manager.connect("debate-1", mock_ws_1)
        await manager.connect("debate-1", mock_ws_2)
        await manager.disconnect("debate-1", mock_ws_1)

        assert manager.get_connection_count("debate-1") == 1

    @pytest.mark.asyncio
    async def test_close_all_for_debate_closes_connections(
        self, manager, mock_ws_1, mock_ws_2
    ):
        await manager.connect("debate-1", mock_ws_1)
        await manager.connect("debate-1", mock_ws_2)

        await manager.close_all_for_debate("debate-1", code=4001, reason="Data stale")

        mock_ws_1.close.assert_called_once_with(code=4001, reason="Data stale")
        mock_ws_2.close.assert_called_once_with(code=4001, reason="Data stale")
        assert "debate-1" not in manager.active_debates

    @pytest.mark.asyncio
    async def test_close_all_for_debate_handles_close_error(self, manager, mock_ws_1):
        mock_ws_1.close.side_effect = RuntimeError("Connection lost")
        await manager.connect("debate-1", mock_ws_1)

        await manager.close_all_for_debate("debate-1")

        assert "debate-1" not in manager.active_debates

    @pytest.mark.asyncio
    async def test_close_all_for_debate_noop_when_no_connections(self, manager):
        await manager.close_all_for_debate("debate-nonexistent")

    @pytest.mark.asyncio
    async def test_broadcast_to_debate_cleans_up_disconnected(
        self, manager, mock_ws_1, mock_ws_2
    ):
        mock_ws_1.send_json.side_effect = RuntimeError("Connection closed")
        await manager.connect("debate-1", mock_ws_1)
        await manager.connect("debate-1", mock_ws_2)

        await manager.broadcast_to_debate("debate-1", {"type": "DEBATE/STATUS_UPDATE"})

        assert manager.get_connection_count("debate-1") == 1
        mock_ws_2.send_json.assert_called_once()

    @pytest.mark.asyncio
    async def test_disconnect_removes_empty_debate(self, manager, mock_ws_1):
        await manager.connect("debate-1", mock_ws_1)
        await manager.disconnect("debate-1", mock_ws_1)

        assert "debate-1" not in manager.active_debates
