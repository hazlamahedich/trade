import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.debate.ws_schemas import WebSocketCloseCodes
from app.services.debate.streaming import connection_manager


class TestWebSocketConnection:
    @pytest.fixture
    def mock_user(self):
        return {"id": "user-123", "email": "test@example.com"}

    @pytest.fixture
    def mock_token(self):
        return "valid-test-token"

    @pytest.mark.asyncio
    async def test_ws_rejects_invalid_token(self):
        from app.routes.ws import validate_token

        result = await validate_token("invalid-token")
        assert result is None

    @pytest.mark.asyncio
    async def test_ws_accepts_fixed_qa_token(self, mock_user):
        from app.routes.ws import validate_token

        with patch("app.routes.ws.settings") as mock_settings:
            mock_settings.FIXED_QA_TOKEN = "test-qa-token"
            mock_settings.CORS_ORIGINS = set()
            mock_settings.ENVIRONMENT = "test"

            result = await validate_token("test-qa-token")
            assert result is not None
            assert result["id"] == "qa-user"

    @pytest.mark.asyncio
    async def test_ws_rejects_rate_limited_ip(self):
        with patch("app.services.debate.streaming.get_redis_client") as mock_redis:
            mock_client = AsyncMock()
            mock_client.incr = AsyncMock(return_value=11)
            mock_client.expire = AsyncMock()
            mock_redis.return_value = mock_client

            from app.services.debate.streaming import check_connection_rate_limit

            result = await check_connection_rate_limit("192.168.1.100")
            assert result is False

    @pytest.mark.asyncio
    async def test_ws_origin_validation(self):
        from app.routes.ws import validate_origin

        mock_ws = MagicMock()
        mock_ws.headers = {"origin": "https://malicious.com"}

        with patch("app.routes.ws.settings") as mock_settings:
            mock_settings.CORS_ORIGINS = {"https://allowed.com"}
            mock_settings.ENVIRONMENT = "production"

            result = await validate_origin(mock_ws)
            assert result is False


class TestTokenValidation:
    @pytest.mark.asyncio
    async def test_validate_token_with_fixed_qa_token(self):
        from app.routes.ws import validate_token

        with patch("app.routes.ws.settings") as mock_settings:
            mock_settings.FIXED_QA_TOKEN = "test-qa-token"

            result = await validate_token("test-qa-token")
            assert result is not None
            assert result["id"] == "qa-user"

    @pytest.mark.asyncio
    async def test_validate_token_rejects_invalid(self):
        from app.routes.ws import validate_token

        result = await validate_token("invalid-token")
        assert result is None


class TestOriginValidation:
    @pytest.mark.asyncio
    async def test_validate_origin_allows_cors_origins(self):
        from app.routes.ws import validate_origin

        mock_ws = MagicMock()
        mock_ws.headers = {"origin": "https://allowed.com"}

        with patch("app.routes.ws.settings") as mock_settings:
            mock_settings.CORS_ORIGINS = {"https://allowed.com"}
            mock_settings.ENVIRONMENT = "production"

            result = await validate_origin(mock_ws)
            assert result is True

    @pytest.mark.asyncio
    async def test_validate_origin_allows_no_origin_in_dev(self):
        from app.routes.ws import validate_origin

        mock_ws = MagicMock()
        mock_ws.headers = {}

        with patch("app.routes.ws.settings") as mock_settings:
            mock_settings.CORS_ORIGINS = set()
            mock_settings.ENVIRONMENT = "development"

            result = await validate_origin(mock_ws)
            assert result is True

    @pytest.mark.asyncio
    async def test_validate_origin_rejects_unknown_origin(self):
        from app.routes.ws import validate_origin

        mock_ws = MagicMock()
        mock_ws.headers = {"origin": "https://malicious.com"}

        with patch("app.routes.ws.settings") as mock_settings:
            mock_settings.CORS_ORIGINS = {"https://allowed.com"}
            mock_settings.ENVIRONMENT = "production"

            result = await validate_origin(mock_ws)
            assert result is False


class TestWebSocketManager:
    @pytest.fixture
    def manager(self):
        return connection_manager

    @pytest.mark.asyncio
    async def test_concurrent_connections_same_debate(self, manager):
        mock_ws1 = AsyncMock()
        mock_ws2 = AsyncMock()
        debate_id = "test-debate-concurrent"

        await manager.connect(debate_id, mock_ws1)
        await manager.connect(debate_id, mock_ws2)

        assert manager.get_connection_count(debate_id) == 2

        await manager.disconnect(debate_id, mock_ws1)
        await manager.disconnect(debate_id, mock_ws2)

    @pytest.mark.asyncio
    async def test_broadcast_to_multiple_clients(self, manager):
        mock_ws1 = AsyncMock()
        mock_ws2 = AsyncMock()
        debate_id = "test-debate-broadcast"

        await manager.connect(debate_id, mock_ws1)
        await manager.connect(debate_id, mock_ws2)

        action = {"type": "DEBATE/TOKEN_RECEIVED", "payload": {"token": "test"}}
        await manager.broadcast_to_debate(debate_id, action)

        mock_ws1.send_json.assert_called_once_with(action)
        mock_ws2.send_json.assert_called_once_with(action)

        await manager.disconnect(debate_id, mock_ws1)
        await manager.disconnect(debate_id, mock_ws2)


class TestHeartbeat:
    @pytest.mark.asyncio
    async def test_heartbeat_sends_ping(self):
        from app.services.debate.streaming import heartbeat
        import asyncio

        mock_ws = AsyncMock()
        mock_manager = MagicMock()
        stop_event = asyncio.Event()

        async def stop_immediately():
            stop_event.set()

        mock_ws.send_json.side_effect = stop_immediately

        await heartbeat(mock_ws, mock_manager, "debate-1", stop_event)


class TestWebSocketCloseCodes:
    def test_close_codes_defined(self):
        assert WebSocketCloseCodes.UNAUTHORIZED == 4001
        assert WebSocketCloseCodes.ORIGIN_NOT_ALLOWED == 4003
        assert WebSocketCloseCodes.DEBATE_NOT_FOUND == 4004
        assert WebSocketCloseCodes.DEBATE_ALREADY_RUNNING == 4009
        assert WebSocketCloseCodes.RATE_LIMITED == 4029
        assert WebSocketCloseCodes.INTERNAL_ERROR == 4500
