import pytest
from unittest.mock import AsyncMock, patch

from app.services.debate.streaming import (
    DebateConnectionManager,
    TokenStreamingHandler,
    DebateStreamState,
    send_connected_action,
    send_status_update,
    send_error,
    send_argument_complete,
    send_turn_change,
)
from app.services.debate.ws_schemas import (
    WebSocketAction,
    WebSocketCloseCodes,
)


class TestDebateConnectionManager:
    @pytest.fixture
    def manager(self):
        return DebateConnectionManager()

    @pytest.fixture
    def mock_websocket(self):
        ws = AsyncMock()
        ws.send_json = AsyncMock()
        return ws

    @pytest.mark.asyncio
    async def test_connect_creates_new_debate(self, manager, mock_websocket):
        await manager.connect("debate-1", mock_websocket)

        assert "debate-1" in manager.active_debates
        assert mock_websocket in manager.active_debates["debate-1"]

    @pytest.mark.asyncio
    async def test_connect_adds_to_existing_debate(self, manager, mock_websocket):
        ws2 = AsyncMock()
        ws2.send_json = AsyncMock()

        await manager.connect("debate-1", mock_websocket)
        await manager.connect("debate-1", ws2)

        assert len(manager.active_debates["debate-1"]) == 2

    @pytest.mark.asyncio
    async def test_disconnect_removes_websocket(self, manager, mock_websocket):
        await manager.connect("debate-1", mock_websocket)
        await manager.disconnect("debate-1", mock_websocket)

        assert "debate-1" not in manager.active_debates

    @pytest.mark.asyncio
    async def test_disconnect_keeps_debate_with_remaining_connections(
        self, manager, mock_websocket
    ):
        ws2 = AsyncMock()
        ws2.send_json = AsyncMock()

        await manager.connect("debate-1", mock_websocket)
        await manager.connect("debate-1", ws2)
        await manager.disconnect("debate-1", mock_websocket)

        assert "debate-1" in manager.active_debates
        assert len(manager.active_debates["debate-1"]) == 1

    @pytest.mark.asyncio
    async def test_broadcast_to_debate(self, manager, mock_websocket):
        await manager.connect("debate-1", mock_websocket)

        action = {"type": "DEBATE/TOKEN_RECEIVED", "payload": {"token": "test"}}
        await manager.broadcast_to_debate("debate-1", action)

        mock_websocket.send_json.assert_called_once_with(action)

    @pytest.mark.asyncio
    async def test_broadcast_handles_disconnected_client(self, manager, mock_websocket):
        mock_websocket.send_json.side_effect = Exception("Connection lost")
        await manager.connect("debate-1", mock_websocket)

        action = {"type": "DEBATE/TOKEN_RECEIVED", "payload": {"token": "test"}}
        await manager.broadcast_to_debate("debate-1", action)

        assert "debate-1" not in manager.active_debates

    def test_get_connection_count(self, manager, mock_websocket):
        assert manager.get_connection_count("debate-1") == 0

        manager.active_debates["debate-1"] = {mock_websocket}
        assert manager.get_connection_count("debate-1") == 1


class TestConnectionRateLimit:
    @pytest.fixture(autouse=True)
    def reset_rate_limit(self):
        yield

    @pytest.mark.asyncio
    async def test_allows_first_connection(self):
        with patch("app.services.debate.streaming.get_redis_client") as mock_redis:
            mock_client = AsyncMock()
            mock_client.incr = AsyncMock(return_value=1)
            mock_client.expire = AsyncMock()
            mock_redis.return_value = mock_client

            from app.services.debate.streaming import check_connection_rate_limit

            result = await check_connection_rate_limit("192.168.1.1")
            assert result is True

    @pytest.mark.asyncio
    async def test_allows_under_limit(self):
        with patch("app.services.debate.streaming.get_redis_client") as mock_redis:
            mock_client = AsyncMock()
            call_count = [0]

            async def mock_incr(key):
                call_count[0] += 1
                return call_count[0]

            mock_client.incr = mock_incr
            mock_client.expire = AsyncMock()
            mock_redis.return_value = mock_client

            from app.services.debate.streaming import check_connection_rate_limit

            ip = "192.168.1.2"
            for i in range(10):
                result = await check_connection_rate_limit(ip)
                if i < 9:
                    assert result is True

    @pytest.mark.asyncio
    async def test_blocks_over_limit(self):
        with patch("app.services.debate.streaming.get_redis_client") as mock_redis:
            mock_client = AsyncMock()
            call_count = [0]

            async def mock_incr(key):
                call_count[0] += 1
                return call_count[0]

            mock_client.incr = mock_incr
            mock_client.expire = AsyncMock()
            mock_redis.return_value = mock_client

            from app.services.debate.streaming import check_connection_rate_limit

            ip = "192.168.1.3"
            for _ in range(11):
                await check_connection_rate_limit(ip)

            result = await check_connection_rate_limit(ip)
            assert result is False

    @pytest.mark.asyncio
    async def test_blocks_unknown_ip(self):
        from app.services.debate.streaming import check_connection_rate_limit

        result = await check_connection_rate_limit("unknown")
        assert result is False


class TestTokenStreamingHandler:
    @pytest.fixture
    def manager(self):
        return DebateConnectionManager()

    @pytest.fixture
    def handler(self, manager):
        return TokenStreamingHandler(manager, "debate-1", "bull")

    @pytest.mark.asyncio
    async def test_on_llm_new_token_broadcasts(self, handler, manager):
        mock_ws = AsyncMock()
        mock_ws.send_json = AsyncMock()
        await manager.connect("debate-1", mock_ws)

        await handler.on_llm_new_token("Hello")

        mock_ws.send_json.assert_called_once()
        call_args = mock_ws.send_json.call_args[0][0]
        assert call_args["type"] == "DEBATE/TOKEN_RECEIVED"
        assert call_args["payload"]["token"] == "Hello"
        assert call_args["payload"]["agent"] == "bull"


class TestDebateStreamState:
    @pytest.fixture
    def stream_state(self):
        return DebateStreamState()

    @pytest.mark.asyncio
    async def test_save_and_get_state(self, stream_state):
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value='{"status": "running"}')
        mock_redis.setex = AsyncMock()

        stream_state._redis = mock_redis

        await stream_state.save_state("debate-1", {"status": "running"})
        state = await stream_state.get_state("debate-1")

        assert state == {"status": "running"}

    @pytest.mark.asyncio
    async def test_get_state_returns_none_when_not_found(self, stream_state):
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)

        stream_state._redis = mock_redis

        state = await stream_state.get_state("nonexistent")
        assert state is None

    @pytest.mark.asyncio
    async def test_delete_state(self, stream_state):
        mock_redis = AsyncMock()
        mock_redis.delete = AsyncMock()

        stream_state._redis = mock_redis

        await stream_state.delete_state("debate-1")
        mock_redis.delete.assert_called_once()


class TestWebSocketActions:
    @pytest.fixture
    def manager(self):
        return DebateConnectionManager()

    @pytest.mark.asyncio
    async def test_send_connected_action(self, manager):
        mock_ws = AsyncMock()
        mock_ws.send_json = AsyncMock()
        await manager.connect("debate-1", mock_ws)

        await send_connected_action(manager, "debate-1", "running")

        call_args = mock_ws.send_json.call_args[0][0]
        assert call_args["type"] == "DEBATE/CONNECTED"
        assert call_args["payload"]["debateId"] == "debate-1"
        assert call_args["payload"]["status"] == "running"

    @pytest.mark.asyncio
    async def test_send_status_update(self, manager):
        mock_ws = AsyncMock()
        mock_ws.send_json = AsyncMock()
        await manager.connect("debate-1", mock_ws)

        await send_status_update(manager, "debate-1", "completed")

        call_args = mock_ws.send_json.call_args[0][0]
        assert call_args["type"] == "DEBATE/STATUS_UPDATE"
        assert call_args["payload"]["status"] == "completed"

    @pytest.mark.asyncio
    async def test_send_error(self, manager):
        mock_ws = AsyncMock()
        mock_ws.send_json = AsyncMock()
        await manager.connect("debate-1", mock_ws)

        await send_error(manager, "debate-1", "INTERNAL_ERROR", "Something went wrong")

        call_args = mock_ws.send_json.call_args[0][0]
        assert call_args["type"] == "DEBATE/ERROR"
        assert call_args["payload"]["code"] == "INTERNAL_ERROR"

    @pytest.mark.asyncio
    async def test_send_argument_complete(self, manager):
        mock_ws = AsyncMock()
        mock_ws.send_json = AsyncMock()
        await manager.connect("debate-1", mock_ws)

        await send_argument_complete(manager, "debate-1", "bull", "Test argument", 1)

        call_args = mock_ws.send_json.call_args[0][0]
        assert call_args["type"] == "DEBATE/ARGUMENT_COMPLETE"
        assert call_args["payload"]["agent"] == "bull"
        assert call_args["payload"]["content"] == "Test argument"

    @pytest.mark.asyncio
    async def test_send_turn_change(self, manager):
        mock_ws = AsyncMock()
        mock_ws.send_json = AsyncMock()
        await manager.connect("debate-1", mock_ws)

        await send_turn_change(manager, "debate-1", "bear")

        call_args = mock_ws.send_json.call_args[0][0]
        assert call_args["type"] == "DEBATE/TURN_CHANGE"
        assert call_args["payload"]["currentAgent"] == "bear"


class TestWebSocketSchemas:
    def test_websocket_action_defaults(self):
        action = WebSocketAction(
            type="DEBATE/TOKEN_RECEIVED", payload={"token": "test"}
        )

        assert action.type == "DEBATE/TOKEN_RECEIVED"
        assert action.payload == {"token": "test"}
        assert action.timestamp is not None

    def test_websocket_action_camel_case_serialization(self):
        action = WebSocketAction(
            type="DEBATE/TOKEN_RECEIVED",
            payload={"debateId": "test"},
        )

        serialized = action.model_dump(by_alias=True)
        assert "debateId" in serialized["payload"]

    def test_close_codes(self):
        assert WebSocketCloseCodes.UNAUTHORIZED == 4001
        assert WebSocketCloseCodes.ORIGIN_NOT_ALLOWED == 4003
        assert WebSocketCloseCodes.DEBATE_NOT_FOUND == 4004
        assert WebSocketCloseCodes.RATE_LIMITED == 4029
        assert WebSocketCloseCodes.INTERNAL_ERROR == 4500


class TestReconnectionFlow:
    @pytest.fixture
    def manager(self):
        return DebateConnectionManager()

    @pytest.fixture
    def stream_state(self):
        state = DebateStreamState()
        state._redis = AsyncMock()
        state._redis.get = AsyncMock(
            return_value='{"status": "running", "current_turn": 2}'
        )
        state._redis.setex = AsyncMock()
        return state

    @pytest.mark.asyncio
    async def test_reconnect_recovers_state(self, manager, stream_state):
        mock_ws1 = AsyncMock()
        mock_ws1.send_json = AsyncMock()

        await manager.connect("debate-reconnect", mock_ws1)
        await stream_state.save_state(
            "debate-reconnect", {"status": "running", "current_turn": 2}
        )

        await manager.disconnect("debate-reconnect", mock_ws1)

        mock_ws2 = AsyncMock()
        mock_ws2.send_json = AsyncMock()
        await manager.connect("debate-reconnect", mock_ws2)

        state = await stream_state.get_state("debate-reconnect")
        assert state is not None
        assert state["status"] == "running"
        assert state["current_turn"] == 2

        await send_connected_action(manager, "debate-reconnect", state["status"])
        mock_ws2.send_json.assert_called()

    @pytest.mark.asyncio
    async def test_completed_debate_reconnect_shows_final_state(
        self, manager, stream_state
    ):
        stream_state._redis.get = AsyncMock(
            return_value='{"status": "completed", "current_turn": 6}'
        )

        mock_ws = AsyncMock()
        mock_ws.send_json = AsyncMock()

        await manager.connect("debate-completed", mock_ws)

        state = await stream_state.get_state("debate-completed")
        assert state["status"] == "completed"

        await send_connected_action(manager, "debate-completed", state["status"])
        call_args = mock_ws.send_json.call_args[0][0]
        assert call_args["payload"]["status"] == "completed"
