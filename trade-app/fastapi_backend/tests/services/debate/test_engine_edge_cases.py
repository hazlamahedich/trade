import asyncio
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.debate.engine import (
    StaleDataError,
    _monitor_freshness,
    stream_debate,
)
from app.services.market.schemas import FreshnessStatus


class TestDebateEngineEdgeCases:
    @pytest.fixture
    def mock_manager(self):
        manager = MagicMock()
        manager.broadcast_to_debate = AsyncMock()
        manager.active_debates = {}
        return manager

    @pytest.mark.asyncio
    async def test_stale_data_error_has_correct_fields(self):
        dt = datetime.utcnow()
        error = StaleDataError(
            code="DATA_STALE",
            message="Market data is 120s old",
            last_update=dt,
        )
        assert error.code == "DATA_STALE"
        assert error.message == "Market data is 120s old"
        assert error.last_update == dt

    @pytest.mark.asyncio
    async def test_monitor_freshness_broadcasts_stale(self, mock_manager):
        stale_status = FreshnessStatus(
            asset="BTC",
            is_stale=True,
            last_update=datetime.utcnow() - timedelta(seconds=75),
            age_seconds=75,
            threshold_seconds=60,
        )

        mock_guardian = MagicMock()
        mock_guardian.get_freshness_status = AsyncMock(return_value=stale_status)

        stale_event = asyncio.Event()

        with patch(
            "app.services.debate.engine.send_data_stale", new_callable=AsyncMock
        ) as mock_send:
            await _monitor_freshness(
                debate_id="debate-1",
                asset="BTC",
                manager=mock_manager,
                guardian=mock_guardian,
                stale_event=stale_event,
            )

            mock_send.assert_called_once_with(mock_manager, "debate-1", stale_status)
            assert stale_event.is_set()

    @pytest.mark.asyncio
    async def test_monitor_freshness_keeps_checking_when_fresh(self, mock_manager):
        fresh_status = FreshnessStatus(
            asset="BTC",
            is_stale=False,
            last_update=datetime.utcnow(),
            age_seconds=5,
            threshold_seconds=60,
        )

        call_count = 0

        async def mock_get_freshness(asset: str):
            nonlocal call_count
            call_count += 1
            if call_count >= 3:
                return FreshnessStatus(
                    asset="BTC",
                    is_stale=True,
                    last_update=datetime.utcnow() - timedelta(seconds=75),
                    age_seconds=75,
                    threshold_seconds=60,
                )
            return fresh_status

        mock_guardian = MagicMock()
        mock_guardian.get_freshness_status = mock_get_freshness

        stale_event = asyncio.Event()

        with patch(
            "app.services.debate.engine.send_data_stale", new_callable=AsyncMock
        ) as mock_send:
            with patch("app.services.debate.engine.FRESHNESS_CHECK_INTERVAL", 0):
                await _monitor_freshness(
                    debate_id="debate-1",
                    asset="BTC",
                    manager=mock_manager,
                    guardian=mock_guardian,
                    stale_event=stale_event,
                )

            assert call_count == 3
            mock_send.assert_called_once()
            assert stale_event.is_set()

    @pytest.mark.asyncio
    async def test_monitor_freshness_handles_cancel(self, mock_manager):
        fresh_status = FreshnessStatus(
            asset="BTC",
            is_stale=False,
            last_update=datetime.utcnow(),
            age_seconds=5,
            threshold_seconds=60,
        )

        mock_guardian = MagicMock()
        mock_guardian.get_freshness_status = AsyncMock(return_value=fresh_status)

        stale_event = asyncio.Event()

        with patch("app.services.debate.engine.FRESHNESS_CHECK_INTERVAL", 100):
            task = asyncio.create_task(
                _monitor_freshness(
                    debate_id="debate-1",
                    asset="BTC",
                    manager=mock_manager,
                    guardian=mock_guardian,
                    stale_event=stale_event,
                )
            )

            await asyncio.sleep(0.01)
            task.cancel()

            try:
                await task
            except asyncio.CancelledError:
                pass

    @pytest.mark.asyncio
    async def test_stale_data_error_default_values(self):
        error = StaleDataError()
        assert error.code == "DATA_STALE"
        assert error.message == "Market data is stale"
        assert error.last_update is None

    @pytest.mark.asyncio
    async def test_stream_debate_no_data_raises_stale_error(self, mock_manager):
        no_data_status = FreshnessStatus(
            asset="BTC",
            is_stale=True,
            last_update=None,
            age_seconds=-1,
            threshold_seconds=60,
        )

        with patch(
            "app.services.debate.engine.StaleDataGuardian"
        ) as mock_guardian_class:
            mock_guardian = MagicMock()
            mock_guardian.get_freshness_status = AsyncMock(return_value=no_data_status)
            mock_guardian_class.return_value = mock_guardian

            with pytest.raises(StaleDataError) as exc_info:
                await stream_debate(
                    debate_id="test-debate",
                    asset="BTC",
                    market_context={},
                    manager=mock_manager,
                )

            assert exc_info.value.code == "DATA_STALE"
            assert "-1s old" in exc_info.value.message
