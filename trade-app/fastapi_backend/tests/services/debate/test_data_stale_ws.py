import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock

from app.services.debate.streaming import (
    DebateConnectionManager,
    send_data_stale,
    send_data_refreshed,
)
from app.services.market.schemas import FreshnessStatus


class TestDataStaleWebSocketActions:
    @pytest.fixture
    def manager(self):
        return DebateConnectionManager()

    @pytest.fixture
    def mock_websocket(self):
        ws = AsyncMock()
        ws.send_json = AsyncMock()
        return ws

    @pytest.fixture
    def stale_freshness(self):
        return FreshnessStatus(
            asset="BTC",
            is_stale=True,
            last_update=datetime.utcnow() - timedelta(seconds=75),
            age_seconds=75,
            threshold_seconds=60,
        )

    @pytest.mark.asyncio
    async def test_send_data_stale_broadcasts_correct_action(
        self, manager, mock_websocket, stale_freshness
    ):
        await manager.connect("debate-1", mock_websocket)

        await send_data_stale(manager, "debate-1", stale_freshness)

        mock_websocket.send_json.assert_called_once()
        action = mock_websocket.send_json.call_args[0][0]
        assert action["type"] == "DEBATE/DATA_STALE"
        assert action["payload"]["debateId"] == "debate-1"
        assert action["payload"]["ageSeconds"] == 75
        assert "Market data is 75 seconds old" in action["payload"]["message"]

    @pytest.mark.asyncio
    async def test_send_data_refreshed_broadcasts_correct_action(
        self, manager, mock_websocket
    ):
        await manager.connect("debate-1", mock_websocket)

        await send_data_refreshed(manager, "debate-1")

        mock_websocket.send_json.assert_called_once()
        action = mock_websocket.send_json.call_args[0][0]
        assert action["type"] == "DEBATE/DATA_REFRESHED"
        assert action["payload"]["debateId"] == "debate-1"
        assert "refreshed" in action["payload"]["message"].lower()

    @pytest.mark.asyncio
    async def test_send_data_stale_with_no_last_update(self, manager, mock_websocket):
        await manager.connect("debate-1", mock_websocket)

        freshness = FreshnessStatus(
            asset="BTC",
            is_stale=True,
            last_update=None,
            age_seconds=-1,
            threshold_seconds=60,
        )

        await send_data_stale(manager, "debate-1", freshness)

        action = mock_websocket.send_json.call_args[0][0]
        assert action["type"] == "DEBATE/DATA_STALE"
        assert action["payload"]["lastUpdate"] is None
