import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.debate.engine import stream_debate
from app.services.market.schemas import FreshnessStatus


class TestDebateEngineStaleData:
    @pytest.fixture
    def mock_manager(self):
        manager = MagicMock()
        manager.broadcast_to_debate = AsyncMock()
        manager.active_debates = {}
        return manager

    @pytest.fixture
    def fresh_status(self):
        return FreshnessStatus(
            asset="BTC",
            is_stale=False,
            last_update=datetime.utcnow(),
            age_seconds=5,
            threshold_seconds=60,
        )

    @pytest.fixture
    def stale_status(self):
        return FreshnessStatus(
            asset="BTC",
            is_stale=True,
            last_update=datetime.utcnow() - timedelta(seconds=120),
            age_seconds=120,
            threshold_seconds=60,
        )

    @pytest.mark.asyncio
    async def test_stream_debate_raises_on_stale_data(self, mock_manager, stale_status):
        with patch(
            "app.services.debate.engine.StaleDataGuardian"
        ) as mock_guardian_class:
            mock_guardian = MagicMock()
            mock_guardian.get_freshness_status = AsyncMock(return_value=stale_status)
            mock_guardian_class.return_value = mock_guardian

            with patch("app.services.debate.engine.stream_state") as mock_stream_state:
                mock_stream_state.save_state = AsyncMock()

                from app.services.debate.engine import StaleDataError

                with pytest.raises(StaleDataError) as exc_info:
                    await stream_debate(
                        debate_id="test-debate",
                        asset="BTC",
                        market_context={"price": 45000},
                        manager=mock_manager,
                    )

                assert exc_info.value.code == "DATA_STALE"

    @pytest.mark.asyncio
    async def test_stream_debate_proceeds_with_fresh_data(
        self, mock_manager, fresh_status
    ):
        with patch(
            "app.services.debate.engine.StaleDataGuardian"
        ) as mock_guardian_class:
            mock_guardian = MagicMock()
            mock_guardian.get_freshness_status = AsyncMock(return_value=fresh_status)
            mock_guardian_class.return_value = mock_guardian

            with patch("app.services.debate.engine.stream_state") as mock_stream_state:
                mock_stream_state.save_state = AsyncMock()

                with patch("app.services.debate.engine.bull_agent_node") as mock_bull:
                    with patch(
                        "app.services.debate.engine.bear_agent_node"
                    ) as mock_bear:
                        mock_bull.return_value = {
                            "messages": [{"role": "bull", "content": "Bull arg"}],
                            "current_turn": 1,
                            "current_agent": "bear",
                        }
                        mock_bear.return_value = {
                            "messages": [
                                {"role": "bull", "content": "Bull arg"},
                                {"role": "bear", "content": "Bear arg"},
                            ],
                            "current_turn": 2,
                            "current_agent": "bull",
                        }

                        result = await stream_debate(
                            debate_id="test-debate",
                            asset="BTC",
                            market_context={"price": 45000},
                            manager=mock_manager,
                            max_turns=2,
                        )

                        assert result["status"] == "completed"
