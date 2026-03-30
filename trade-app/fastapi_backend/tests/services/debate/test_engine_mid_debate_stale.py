import asyncio
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.debate.engine import StaleDataError, stream_debate
from app.services.market.schemas import FreshnessStatus


def _make_bull_side_effect(max_calls: int):
    call_count = 0

    async def side_effect(state, manager=None, debate_id=None):
        nonlocal call_count
        call_count += 1
        await asyncio.sleep(0.02)
        return {
            "messages": [{"role": "bull", "content": f"Bull arg {call_count}"}],
            "current_turn": state["current_turn"] + 1,
            "current_agent": "bear",
        }

    return side_effect


def _make_bear_side_effect():
    call_count = 0

    async def side_effect(state, manager=None, debate_id=None):
        nonlocal call_count
        call_count += 1
        await asyncio.sleep(0.02)
        return {
            "messages": [{"role": "bear", "content": f"Bear arg {call_count}"}],
            "current_turn": state["current_turn"] + 1,
            "current_agent": "bull",
        }

    return side_effect


class TestStreamDebateMidDebateStale:
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

    @pytest.mark.asyncio
    async def test_mid_debate_stale_triggers_paused_state(
        self, mock_manager, fresh_status
    ):
        stale_status = FreshnessStatus(
            asset="BTC",
            is_stale=True,
            last_update=datetime.utcnow() - timedelta(seconds=75),
            age_seconds=75,
            threshold_seconds=60,
        )

        call_count = 0

        async def mock_get_freshness(asset: str):
            nonlocal call_count
            call_count += 1
            if call_count >= 2:
                return stale_status
            return fresh_status

        mock_guardian = MagicMock()
        mock_guardian.get_freshness_status = mock_get_freshness

        with patch("app.services.debate.engine.stream_state") as mock_stream_state:
            mock_stream_state.save_state = AsyncMock()

            with patch("app.services.debate.engine.FRESHNESS_CHECK_INTERVAL", 0):
                with patch(
                    "app.services.debate.engine.send_data_stale", new_callable=AsyncMock
                ):
                    with patch(
                        "app.services.debate.engine.send_status_update",
                        new_callable=AsyncMock,
                    ) as mock_send_status:
                        with (
                            patch(
                                "app.services.debate.engine.bull_agent_node",
                                side_effect=_make_bull_side_effect(10),
                            ),
                            patch(
                                "app.services.debate.engine.bear_agent_node",
                                side_effect=_make_bear_side_effect(),
                            ),
                        ):
                            with pytest.raises(StaleDataError) as exc_info:
                                await stream_debate(
                                    debate_id="test-debate",
                                    asset="BTC",
                                    market_context={"price": 45000},
                                    manager=mock_manager,
                                    max_turns=10,
                                    stale_guardian=mock_guardian,
                                )

                            assert "Debate paused" in exc_info.value.message
                            assert exc_info.value.code == "DATA_STALE"

                            paused_save_calls = [
                                c
                                for c in mock_stream_state.save_state.call_args_list
                                if c[0][1].get("status") == "paused"
                            ]
                            assert len(paused_save_calls) == 1
                            assert paused_save_calls[0][0][1]["reason"] == "DATA_STALE"

                            status_calls = [
                                c[0][2]
                                for c in mock_send_status.call_args_list
                                if c[0][2] == "paused"
                            ]
                            assert "paused" in status_calls

    @pytest.mark.asyncio
    async def test_mid_debate_stale_cancels_monitor_task(
        self, mock_manager, fresh_status
    ):
        stale_status = FreshnessStatus(
            asset="BTC",
            is_stale=True,
            last_update=datetime.utcnow() - timedelta(seconds=75),
            age_seconds=75,
            threshold_seconds=60,
        )

        call_count = 0

        async def mock_get_freshness(asset: str):
            nonlocal call_count
            call_count += 1
            if call_count >= 2:
                return stale_status
            return fresh_status

        mock_guardian = MagicMock()
        mock_guardian.get_freshness_status = mock_get_freshness

        with patch("app.services.debate.engine.stream_state") as mock_stream_state:
            mock_stream_state.save_state = AsyncMock()

            with patch("app.services.debate.engine.FRESHNESS_CHECK_INTERVAL", 0):
                with patch(
                    "app.services.debate.engine.send_data_stale", new_callable=AsyncMock
                ):
                    with patch(
                        "app.services.debate.engine.send_status_update",
                        new_callable=AsyncMock,
                    ):
                        with (
                            patch(
                                "app.services.debate.engine.bull_agent_node",
                                side_effect=_make_bull_side_effect(10),
                            ),
                            patch(
                                "app.services.debate.engine.bear_agent_node",
                                side_effect=_make_bear_side_effect(),
                            ),
                        ):
                            with pytest.raises(StaleDataError):
                                await stream_debate(
                                    debate_id="test-debate",
                                    asset="BTC",
                                    market_context={"price": 45000},
                                    manager=mock_manager,
                                    max_turns=10,
                                    stale_guardian=mock_guardian,
                                )

    @pytest.mark.asyncio
    async def test_completed_state_saved_on_successful_debate(
        self, mock_manager, fresh_status
    ):
        mock_guardian = MagicMock()
        mock_guardian.get_freshness_status = AsyncMock(return_value=fresh_status)

        with patch("app.services.debate.engine.stream_state") as mock_stream_state:
            mock_stream_state.save_state = AsyncMock()

            with patch(
                "app.services.debate.engine.send_status_update", new_callable=AsyncMock
            ) as mock_send_status:
                with (
                    patch(
                        "app.services.debate.engine.bull_agent_node",
                        side_effect=_make_bull_side_effect(2),
                    ),
                    patch(
                        "app.services.debate.engine.bear_agent_node",
                        side_effect=_make_bear_side_effect(),
                    ),
                ):
                    result = await stream_debate(
                        debate_id="test-debate",
                        asset="BTC",
                        market_context={"price": 45000},
                        manager=mock_manager,
                        max_turns=2,
                        stale_guardian=mock_guardian,
                    )

                    assert result["status"] == "completed"

                    completed_saves = [
                        c
                        for c in mock_stream_state.save_state.call_args_list
                        if c[0][1].get("status") == "completed"
                    ]
                    assert len(completed_saves) == 1

                    assert mock_send_status.call_args_list[-1][0][2] == "completed"

    @pytest.mark.asyncio
    async def test_generic_exception_saves_error_state(
        self, mock_manager, fresh_status
    ):
        mock_guardian = MagicMock()
        mock_guardian.get_freshness_status = AsyncMock(return_value=fresh_status)

        with patch("app.services.debate.engine.stream_state") as mock_stream_state:
            mock_stream_state.save_state = AsyncMock()

            with patch(
                "app.services.debate.engine.send_status_update", new_callable=AsyncMock
            ) as mock_send_status:
                with patch("app.services.debate.engine.bull_agent_node") as mock_bull:
                    mock_bull.side_effect = RuntimeError("LLM provider unavailable")

                    with pytest.raises(RuntimeError, match="LLM provider unavailable"):
                        await stream_debate(
                            debate_id="test-debate",
                            asset="BTC",
                            market_context={"price": 45000},
                            manager=mock_manager,
                            max_turns=2,
                            stale_guardian=mock_guardian,
                        )

                    error_saves = [
                        c
                        for c in mock_stream_state.save_state.call_args_list
                        if c[0][1].get("status") == "error"
                    ]
                    assert len(error_saves) == 1
                    assert "LLM provider unavailable" in error_saves[0][0][1]["error"]

                    assert mock_send_status.call_args_list[-1][0][2] == "error"
