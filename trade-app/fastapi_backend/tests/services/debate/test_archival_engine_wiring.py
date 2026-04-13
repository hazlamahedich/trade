from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime, timezone

import pytest

from app.services.market.schemas import FreshnessStatus


def _safe_analyze(state):
    return {
        "should_interrupt": False,
        "risk_level": "low",
        "reason": "ok",
        "fallacy_type": None,
        "summary_verdict": "Wait",
        "safe": True,
        "detailed_reasoning": "",
    }


def _patched_stale_guardian():
    from app.services.debate.engine import StaleDataGuardian

    mock_sg_cls = patch(StaleDataGuardian.__module__ + ".StaleDataGuardian")
    return mock_sg_cls


class TestArchivalEngineWiring:
    """[4-1-UNIT] Tests for archival wiring into stream_debate."""

    @pytest.mark.asyncio
    async def test_stream_debate_calls_archive_on_completion(self, mock_manager):
        from app.services.debate.engine import stream_debate
        from tests.services.debate.test_helpers import patched_debate_engine

        with patched_debate_engine(_safe_analyze) as _mocks:
            with patch("app.services.debate.engine.archive_debate") as mock_archive:
                mock_archive.return_value = AsyncMock()
                with patch(
                    "app.services.debate.engine.StaleDataGuardian"
                ) as mock_sg_cls:
                    mock_sg = MagicMock()
                    mock_sg.get_freshness_status = AsyncMock(
                        return_value=FreshnessStatus(
                            asset="BTC",
                            is_stale=False,
                            last_update=datetime.now(timezone.utc),
                            age_seconds=5,
                            threshold_seconds=60,
                        )
                    )
                    mock_sg_cls.return_value = mock_sg

                    await stream_debate(
                        debate_id="deb_test123",
                        asset="bitcoin",
                        market_context={"summary": "test"},
                        manager=mock_manager,
                        max_turns=2,
                    )

        mock_archive.assert_called_once()
        call_args = mock_archive.call_args
        assert call_args[0][0] == "deb_test123"

    @pytest.mark.asyncio
    async def test_stream_debate_calls_archive_on_critical_interrupt(
        self, mock_manager
    ):
        from app.services.debate.engine import stream_debate
        from tests.services.debate.test_helpers import patched_debate_engine

        analyze_call_count = [0]

        async def critical_analyze(state):
            analyze_call_count[0] += 1
            if analyze_call_count[0] == 1:
                return {
                    "should_interrupt": True,
                    "risk_level": "critical",
                    "reason": "Dangerous",
                    "fallacy_type": None,
                    "summary_verdict": "High Risk",
                    "safe": False,
                    "detailed_reasoning": "",
                }
            return _safe_analyze(state)

        with patched_debate_engine(critical_analyze) as _mocks:
            with patch("app.services.debate.engine.archive_debate") as mock_archive:
                mock_archive.return_value = AsyncMock()
                with patch(
                    "app.services.debate.engine.StaleDataGuardian"
                ) as mock_sg_cls:
                    mock_sg = MagicMock()
                    mock_sg.get_freshness_status = AsyncMock(
                        return_value=FreshnessStatus(
                            asset="BTC",
                            is_stale=False,
                            last_update=datetime.now(timezone.utc),
                            age_seconds=5,
                            threshold_seconds=60,
                        )
                    )
                    mock_sg_cls.return_value = mock_sg

                    await stream_debate(
                        debate_id="deb_critical",
                        asset="bitcoin",
                        market_context={"summary": "test"},
                        manager=mock_manager,
                        max_turns=2,
                    )

        mock_archive.assert_called_once()
        assert mock_archive.call_args[0][0] == "deb_critical"

    @pytest.mark.asyncio
    async def test_debate_completes_even_if_archival_fails(self, mock_manager):
        from app.services.debate.engine import stream_debate
        from tests.services.debate.test_helpers import patched_debate_engine

        with patched_debate_engine(_safe_analyze) as _mocks:
            with patch("app.services.debate.engine.archive_debate") as mock_archive:
                mock_archive.side_effect = Exception("Archival exploded")
                with patch(
                    "app.services.debate.engine.StaleDataGuardian"
                ) as mock_sg_cls:
                    mock_sg = MagicMock()
                    mock_sg.get_freshness_status = AsyncMock(
                        return_value=FreshnessStatus(
                            asset="BTC",
                            is_stale=False,
                            last_update=datetime.now(timezone.utc),
                            age_seconds=5,
                            threshold_seconds=60,
                        )
                    )
                    mock_sg_cls.return_value = mock_sg

                    result = await stream_debate(
                        debate_id="deb_archfail",
                        asset="bitcoin",
                        market_context={"summary": "test"},
                        manager=mock_manager,
                        max_turns=2,
                    )

        assert result["status"] == "completed"

    @pytest.mark.asyncio
    async def test_stream_debate_error_path_does_not_archive(self, mock_manager):
        from app.services.debate.engine import stream_debate
        from tests.services.debate.test_helpers import patched_debate_engine

        with patched_debate_engine(_safe_analyze) as mocks:
            mocks["stream_state"].save_state = AsyncMock(
                side_effect=Exception("Redis down")
            )
            with patch("app.services.debate.engine.archive_debate") as mock_archive:
                with patch(
                    "app.services.debate.engine.StaleDataGuardian"
                ) as mock_sg_cls:
                    mock_sg = MagicMock()
                    mock_sg.get_freshness_status = AsyncMock(
                        return_value=FreshnessStatus(
                            asset="BTC",
                            is_stale=False,
                            last_update=datetime.now(timezone.utc),
                            age_seconds=5,
                            threshold_seconds=60,
                        )
                    )
                    mock_sg_cls.return_value = mock_sg

                    with pytest.raises(Exception):
                        await stream_debate(
                            debate_id="deb_err",
                            asset="bitcoin",
                            market_context={"summary": "test"},
                            manager=mock_manager,
                            max_turns=2,
                        )

        mock_archive.assert_not_called()
