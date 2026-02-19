from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


class TestHealthEndpoint:
    @patch("app.routes.health.check_database", new_callable=AsyncMock)
    @patch("app.routes.health.check_redis", new_callable=AsyncMock)
    def test_health_check_returns_standard_response_envelope(self, mock_redis, mock_db):
        mock_db.return_value = "connected"
        mock_redis.return_value = "connected"

        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "error" in data
        assert "meta" in data
        assert data["data"]["status"] == "healthy"
        assert data["data"]["database"] == "connected"
        assert data["data"]["redis"] == "connected"
        assert data["error"] is None
        assert "version" in data["meta"]

    @patch("app.routes.health.check_database", new_callable=AsyncMock)
    @patch("app.routes.health.check_redis", new_callable=AsyncMock)
    def test_health_check_response_structure(self, mock_redis, mock_db):
        mock_db.return_value = "connected"
        mock_redis.return_value = "connected"

        response = client.get("/api/health")
        data = response.json()
        assert data["data"]["status"] == "healthy"
        assert data["meta"]["version"] == "1.0.0"

    @patch("app.routes.health.check_database", new_callable=AsyncMock)
    @patch("app.routes.health.check_redis", new_callable=AsyncMock)
    def test_health_check_returns_unhealthy_when_db_down(self, mock_redis, mock_db):
        mock_db.return_value = "disconnected"
        mock_redis.return_value = "connected"

        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["status"] == "unhealthy"
        assert data["data"]["database"] == "disconnected"

    @patch("app.routes.health.check_database", new_callable=AsyncMock)
    @patch("app.routes.health.check_redis", new_callable=AsyncMock)
    def test_health_check_returns_unhealthy_when_redis_down(self, mock_redis, mock_db):
        mock_db.return_value = "connected"
        mock_redis.return_value = "disconnected"

        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["status"] == "unhealthy"
        assert data["data"]["redis"] == "disconnected"
