from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.services.market.schemas import MarketData, MarketMeta

client = TestClient(app)


class TestMarketEndpoint:
    @patch("app.routes.market.market_service.get_data", new_callable=AsyncMock)
    def test_get_market_data_success(self, mock_get_data):
        market_data = MarketData(
            asset="BTC",
            price=45000.0,
            currency="usd",
            news=[],
            is_stale=False,
        )
        meta = MarketMeta(latency_ms=150, provider="coingecko")
        mock_get_data.return_value = (market_data, meta)

        response = client.get("/api/market/BTC/data")

        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "error" in data
        assert "meta" in data
        assert data["data"]["asset"] == "BTC"
        assert data["data"]["price"] == 45000.0
        assert data["data"]["isStale"] is False
        assert data["error"] is None
        assert data["meta"]["provider"] == "coingecko"

    @patch("app.routes.market.market_service.get_data", new_callable=AsyncMock)
    def test_get_market_data_lowercase_asset(self, mock_get_data):
        market_data = MarketData(asset="ETH", price=3000.0, news=[])
        meta = MarketMeta(latency_ms=100, provider="coingecko")
        mock_get_data.return_value = (market_data, meta)

        response = client.get("/api/market/eth/data")

        assert response.status_code == 200
        assert response.json()["data"]["asset"] == "ETH"

    def test_get_market_data_invalid_asset(self):
        response = client.get("/api/market/INVALID/data")

        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["error"]["code"] == "INVALID_ASSET"
        assert "not supported" in data["detail"]["error"]["message"]

    def test_get_market_data_lowercase_asset_names(self):
        """Test that lowercase asset names (bitcoin, ethereum, solana) work."""
        for asset_name, symbol in [("bitcoin", "BTC"), ("ethereum", "ETH"), ("solana", "SOL")]:
            with patch(
                "app.routes.market.market_service.get_data", new_callable=AsyncMock
            ) as mock:
                mock.return_value = (
                    MarketData(asset=symbol, price=100.0, news=[]),
                    MarketMeta(latency_ms=50, provider="test"),
                )
                response = client.get(f"/api/market/{asset_name}/data")
                assert response.status_code == 200
                assert response.json()["data"]["asset"] == symbol

    def test_get_market_data_unavailable_when_no_data(self):
        with patch(
            "app.routes.market.market_service.get_data", new_callable=AsyncMock
        ) as mock_get_data:
            mock_get_data.return_value = (None, MarketMeta(latency_ms=50))

            response = client.get("/api/market/BTC/data")

            assert response.status_code == 503
            data = response.json()
            assert data["detail"]["error"]["code"] == "MARKET_DATA_UNAVAILABLE"

    @patch("app.routes.market.market_service.get_data", new_callable=AsyncMock)
    def test_get_market_data_stale_warning_in_meta(self, mock_get_data):
        market_data = MarketData(asset="BTC", price=45000.0, news=[], is_stale=True)
        meta = MarketMeta(latency_ms=100, provider="cache", stale_warning=True)
        mock_get_data.return_value = (market_data, meta)

        response = client.get("/api/market/BTC/data")

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["isStale"] is True
        assert data["meta"]["staleWarning"] is True

    def test_all_supported_assets(self):
        for asset in ["BTC", "ETH", "SOL"]:
            with patch(
                "app.routes.market.market_service.get_data", new_callable=AsyncMock
            ) as mock:
                mock.return_value = (
                    MarketData(asset=asset, price=100.0, news=[]),
                    MarketMeta(latency_ms=50, provider="test"),
                )
                response = client.get(f"/api/market/{asset}/data")
                assert response.status_code == 200
                assert response.json()["data"]["asset"] == asset
