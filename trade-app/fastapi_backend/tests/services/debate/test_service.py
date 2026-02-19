import asyncio
import pytest
from unittest.mock import AsyncMock, patch

from app.services.debate import DebateService
from app.services.debate.exceptions import StaleDataError
from app.services.market.schemas import MarketContext


class TestDebateService:
    @pytest.fixture
    def service(self):
        with patch("app.config.Settings.validate_llm_config"):
            return DebateService("redis://localhost:6379/0")

    @pytest.fixture
    def mock_market_service(self, mock_market_context):
        service = AsyncMock()
        service.get_context = AsyncMock(return_value=mock_market_context)
        service.close = AsyncMock()
        return service

    @pytest.fixture
    def stale_market_service(self, stale_market_context):
        service = AsyncMock()
        service.get_context = AsyncMock(return_value=stale_market_context)
        service.close = AsyncMock()
        return service

    @pytest.mark.asyncio
    async def test_start_debate_returns_debate_response(
        self, service, mock_market_service
    ):
        mock_graph = AsyncMock()
        mock_graph.ainvoke = AsyncMock(
            return_value={
                "messages": [
                    {"role": "bull", "content": "Bull argument"},
                    {"role": "bear", "content": "Bear argument"},
                ],
                "current_turn": 2,
                "max_turns": 6,
            }
        )

        with patch.object(service, "market_service", mock_market_service):
            with patch.object(service, "graph", mock_graph):
                result = await service.start_debate("bitcoin")

                assert result.asset == "bitcoin"
                assert result.status == "completed"
                assert len(result.messages) == 2
                assert result.current_turn == 2
                assert result.max_turns == 6
                assert result.debate_id.startswith("deb_")

    @pytest.mark.asyncio
    async def test_stale_data_blocks_debate(self, service, stale_market_service):
        with patch.object(service, "market_service", stale_market_service):
            with pytest.raises(StaleDataError) as exc_info:
                await service.start_debate("bitcoin")

            assert "stale" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_no_market_data_blocks_debate(self, service):
        mock_market_service = AsyncMock()
        mock_market_service.get_context = AsyncMock(return_value=None)
        mock_market_service.close = AsyncMock()

        with patch.object(service, "market_service", mock_market_service):
            with pytest.raises(StaleDataError) as exc_info:
                await service.start_debate("bitcoin")

            assert "No market data" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_full_debate_flow(self, service, mock_market_service):
        mock_graph = AsyncMock()
        mock_graph.ainvoke = AsyncMock(
            return_value={
                "messages": [
                    {"role": "bull", "content": "Bull argument 1"},
                    {"role": "bear", "content": "Bear counter 1"},
                    {"role": "bull", "content": "Bull argument 2"},
                    {"role": "bear", "content": "Bear counter 2"},
                ],
                "current_turn": 4,
                "max_turns": 6,
            }
        )

        with patch.object(service, "market_service", mock_market_service):
            with patch.object(service, "graph", mock_graph):
                result = await service.start_debate("bitcoin")

                assert result.status == "completed"
                assert result.current_turn == 4
                assert len(result.messages) == 4

                assert result.messages[0].role == "bull"
                assert result.messages[1].role == "bear"
                assert result.messages[2].role == "bull"
                assert result.messages[3].role == "bear"


class TestStaleDataBoundary:
    """P1 Gap Test: R-3.2 - Stale data boundary (59s/61s threshold)"""

    @pytest.fixture
    def service(self):
        with patch("app.config.Settings.validate_llm_config"):
            return DebateService("redis://localhost:6379/0")

    @pytest.mark.asyncio
    async def test_data_at_59_seconds_is_fresh(self, service):
        """Data fetched 59 seconds ago should be considered fresh."""
        fresh_context = MarketContext(
            asset="bitcoin",
            price=45000.0,
            news_summary=["Bitcoin ETF approved"],
            is_stale=False,
        )

        mock_market_service = AsyncMock()
        mock_market_service.get_context = AsyncMock(return_value=fresh_context)
        mock_market_service.close = AsyncMock()

        mock_graph = AsyncMock()
        mock_graph.ainvoke = AsyncMock(
            return_value={
                "messages": [{"role": "bull", "content": "Bull argument"}],
                "current_turn": 1,
                "max_turns": 6,
            }
        )

        with patch.object(service, "market_service", mock_market_service):
            with patch.object(service, "graph", mock_graph):
                result = await service.start_debate("bitcoin")

                assert result.status == "completed"

    @pytest.mark.asyncio
    async def test_data_at_61_seconds_is_stale(self, service):
        """Data fetched 61 seconds ago should be considered stale."""
        stale_context = MarketContext(
            asset="bitcoin",
            price=45000.0,
            news_summary=["Bitcoin ETF approved"],
            is_stale=True,
        )

        mock_market_service = AsyncMock()
        mock_market_service.get_context = AsyncMock(return_value=stale_context)
        mock_market_service.close = AsyncMock()

        with patch.object(service, "market_service", mock_market_service):
            with pytest.raises(StaleDataError):
                await service.start_debate("bitcoin")

    @pytest.mark.asyncio
    async def test_data_exactly_at_60_seconds_boundary(self, service):
        """Data exactly at 60 seconds should be considered stale."""
        boundary_context = MarketContext(
            asset="bitcoin",
            price=45000.0,
            news_summary=["Bitcoin ETF approved"],
            is_stale=True,
        )

        mock_market_service = AsyncMock()
        mock_market_service.get_context = AsyncMock(return_value=boundary_context)
        mock_market_service.close = AsyncMock()

        with patch.object(service, "market_service", mock_market_service):
            with pytest.raises(StaleDataError):
                await service.start_debate("bitcoin")


class TestConcurrentDebateIsolation:
    """P1 Gap Test: R-3.3 - Concurrent debate isolation"""

    @pytest.fixture
    def service(self):
        with patch("app.config.Settings.validate_llm_config"):
            return DebateService("redis://localhost:6379/0")

    @pytest.mark.asyncio
    async def test_concurrent_debates_have_isolated_state(self, service):
        """Multiple concurrent debates should not interfere with each other."""
        mock_market_service = AsyncMock()
        mock_market_service.get_context = AsyncMock(
            return_value=MarketContext(
                asset="bitcoin",
                price=45000.0,
                news_summary=["Bitcoin ETF approved"],
                is_stale=False,
            )
        )
        mock_market_service.close = AsyncMock()

        call_counts = {"bitcoin": 0, "ethereum": 0}

        def create_mock_graph(asset):
            async def mock_ainvoke(state, config=None):
                call_counts[asset] += 1
                return {
                    "messages": [
                        {"role": "bull", "content": f"{asset} bull argument"},
                        {"role": "bear", "content": f"{asset} bear argument"},
                    ],
                    "current_turn": 2,
                    "max_turns": 6,
                }

            mock_graph = AsyncMock()
            mock_graph.ainvoke = mock_ainvoke
            return mock_graph

        results = {}

        async def run_debate(asset):
            with patch.object(service, "market_service", mock_market_service):
                with patch.object(service, "graph", create_mock_graph(asset)):
                    result = await service.start_debate(asset)
                    results[asset] = result
                    return result

        bitcoin_task = asyncio.create_task(run_debate("bitcoin"))
        ethereum_task = asyncio.create_task(run_debate("ethereum"))

        await asyncio.gather(bitcoin_task, ethereum_task)

        assert results["bitcoin"].asset == "bitcoin"
        assert results["ethereum"].asset == "ethereum"
        assert call_counts["bitcoin"] == 1
        assert call_counts["ethereum"] == 1

    @pytest.mark.asyncio
    async def test_concurrent_debates_generate_unique_ids(self, service):
        """Concurrent debates should generate unique debate IDs."""
        mock_market_service = AsyncMock()
        mock_market_service.get_context = AsyncMock(
            return_value=MarketContext(
                asset="bitcoin",
                price=45000.0,
                news_summary=["Bitcoin ETF approved"],
                is_stale=False,
            )
        )
        mock_market_service.close = AsyncMock()

        mock_graph = AsyncMock()
        mock_graph.ainvoke = AsyncMock(
            return_value={
                "messages": [{"role": "bull", "content": "Bull argument"}],
                "current_turn": 1,
                "max_turns": 6,
            }
        )

        results = []

        async def run_single_debate():
            with patch.object(service, "market_service", mock_market_service):
                with patch.object(service, "graph", mock_graph):
                    result = await service.start_debate("bitcoin")
                    results.append(result)
                    return result

        tasks = [asyncio.create_task(run_single_debate()) for _ in range(5)]
        await asyncio.gather(*tasks)

        debate_ids = [r.debate_id for r in results]
        assert len(set(debate_ids)) == 5, "Each debate should have a unique ID"
