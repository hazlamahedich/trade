import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.services.debate.schemas import DebateResponse, DebateMessage


class TestDebateRoutes:
    @pytest.fixture
    def mock_debate_response(self):
        return DebateResponse(
            debate_id="deb_abc12345",
            asset="bitcoin",
            status="completed",
            messages=[
                DebateMessage(role="bull", content="Bull argument"),
                DebateMessage(role="bear", content="Bear counter"),
            ],
            current_turn=2,
            max_turns=6,
        )

    @pytest.mark.asyncio
    async def test_start_debate_success(self, mock_debate_response):
        with patch("app.routes.debate.get_debate_service") as mock_get_service:
            mock_service = AsyncMock()
            mock_service.start_debate = AsyncMock(return_value=mock_debate_response)
            mock_get_service.return_value = mock_service

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/start", json={"asset": "bitcoin"}
                )

                assert response.status_code == 200
                data = response.json()
                assert data["data"]["asset"] == "bitcoin"
                assert data["data"]["status"] == "completed"
                assert data["error"] is None

    @pytest.mark.asyncio
    async def test_start_debate_stale_data_error(self):
        from app.services.debate.exceptions import StaleDataError

        with patch("app.routes.debate.get_debate_service") as mock_get_service:
            mock_service = AsyncMock()
            mock_service.start_debate = AsyncMock(
                side_effect=StaleDataError("Cannot start debate with stale data")
            )
            mock_get_service.return_value = mock_service

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/start", json={"asset": "bitcoin"}
                )

                assert response.status_code == 400
                data = response.json()
                assert data["detail"]["error"]["code"] == "STALE_MARKET_DATA"

    @pytest.mark.asyncio
    async def test_start_debate_llm_error(self):
        from app.services.debate.exceptions import LLMProviderError

        with patch("app.routes.debate.get_debate_service") as mock_get_service:
            mock_service = AsyncMock()
            mock_service.start_debate = AsyncMock(
                side_effect=LLMProviderError("LLM failed")
            )
            mock_get_service.return_value = mock_service

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/start", json={"asset": "bitcoin"}
                )

                assert response.status_code == 503
                data = response.json()
                assert data["detail"]["error"]["code"] == "LLM_PROVIDER_ERROR"

    @pytest.mark.asyncio
    async def test_start_debate_invalid_asset(self):
        with patch("app.routes.debate.get_debate_service") as mock_get_service:
            mock_service = AsyncMock()
            mock_get_service.return_value = mock_service

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post("/api/debate/start", json={"asset": ""})

                assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_start_debate_asset_too_long(self):
        with patch("app.routes.debate.get_debate_service") as mock_get_service:
            mock_service = AsyncMock()
            mock_get_service.return_value = mock_service

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/start", json={"asset": "a" * 21}
                )

                assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_start_debate_unsupported_asset(self):
        with patch("app.routes.debate.get_debate_service") as mock_get_service:
            mock_service = AsyncMock()
            mock_get_service.return_value = mock_service

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/start", json={"asset": "dogecoin"}
                )

                assert response.status_code == 422
                data = response.json()
                assert "Unsupported asset" in str(data)

    @pytest.mark.asyncio
    async def test_start_debate_normalizes_asset(self, mock_debate_response):
        """Asset should be normalized to lowercase."""
        with patch("app.routes.debate.get_debate_service") as mock_get_service:
            mock_service = AsyncMock()
            mock_service.start_debate = AsyncMock(return_value=mock_debate_response)
            mock_get_service.return_value = mock_service

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/start", json={"asset": "BITCOIN"}
                )

                assert response.status_code == 200
                mock_service.start_debate.assert_called_once()
                called_asset = mock_service.start_debate.call_args[0][0]
                assert called_asset == "bitcoin"
