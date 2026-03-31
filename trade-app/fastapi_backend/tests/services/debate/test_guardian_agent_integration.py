import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from app.services.debate.agents.guardian import GuardianAgent
from app.services.debate.engine import stream_debate
from tests.services.debate.conftest import make_guardian_result


def _patch_engine_mocks(
    mock_bull_class, mock_bear_class, mock_guardian_class, mock_stream_state
):
    mock_stream_state.save_state = AsyncMock()

    mock_bull = MagicMock()
    mock_bull.generate = AsyncMock(
        side_effect=lambda s: {
            "messages": s["messages"] + [{"role": "bull", "content": "Bull arg"}],
            "current_turn": s["current_turn"] + 1,
            "current_agent": "bear",
        }
    )
    mock_bull_class.return_value = mock_bull

    mock_bear = MagicMock()
    mock_bear.generate = AsyncMock(
        side_effect=lambda s: {
            "messages": s["messages"] + [{"role": "bear", "content": "Bear arg"}],
            "current_turn": s["current_turn"] + 1,
            "current_agent": "bull",
        }
    )
    mock_bear_class.return_value = mock_bear

    return mock_bull, mock_bear


class TestGuardianEngineIntegration:
    @pytest.mark.asyncio
    async def test_2_1_int_001_guardian_called_per_turn(
        self, mock_manager, mock_stale_guardian
    ):
        # Given: guardian is enabled with safe analysis
        # When: stream_debate runs for 2 turns
        # Then: guardian.analyze is called at least once per turn

        with (
            patch("app.services.debate.engine.BullAgent") as mock_bull_class,
            patch("app.services.debate.engine.BearAgent") as mock_bear_class,
            patch("app.services.debate.engine.GuardianAgent") as mock_guardian_class,
            patch("app.services.debate.engine.stream_state") as mock_stream_state,
        ):
            _patch_engine_mocks(
                mock_bull_class, mock_bear_class, mock_guardian_class, mock_stream_state
            )

            mock_guardian = MagicMock()
            mock_guardian.analyze = AsyncMock(
                return_value=make_guardian_result().model_dump()
            )
            mock_guardian_class.return_value = mock_guardian

            with patch("app.config.settings") as mock_settings:
                mock_settings.guardian_enabled = True

                await stream_debate(
                    debate_id="test-debate",
                    asset="BTC",
                    market_context={"summary": "test"},
                    manager=mock_manager,
                    max_turns=2,
                    stale_guardian=mock_stale_guardian,
                )

            assert mock_guardian.analyze.call_count >= 2

    @pytest.mark.asyncio
    async def test_2_1_int_002_guardian_emits_risk_check_nodes(
        self, mock_manager, mock_stale_guardian
    ):
        # Given: guardian returns safe analysis
        # When: stream_debate completes
        # Then: DEBATE/REASONING_NODE with nodeType=risk_check and label="Guardian: Safe" is broadcast

        with (
            patch("app.services.debate.engine.BullAgent") as mock_bull_class,
            patch("app.services.debate.engine.BearAgent") as mock_bear_class,
            patch("app.services.debate.engine.GuardianAgent") as mock_guardian_class,
            patch("app.services.debate.engine.stream_state") as mock_stream_state,
        ):
            _patch_engine_mocks(
                mock_bull_class, mock_bear_class, mock_guardian_class, mock_stream_state
            )

            mock_guardian = MagicMock()
            mock_guardian.analyze = AsyncMock(
                return_value=make_guardian_result().model_dump()
            )
            mock_guardian_class.return_value = mock_guardian

            with patch("app.config.settings") as mock_settings:
                mock_settings.guardian_enabled = True

                await stream_debate(
                    debate_id="test-debate",
                    asset="BTC",
                    market_context={"summary": "test"},
                    manager=mock_manager,
                    max_turns=2,
                    stale_guardian=mock_stale_guardian,
                )

            broadcasts = mock_manager.broadcast_to_debate.call_args_list
            risk_check_found = False
            for call in broadcasts:
                action_data = call[0][1]
                if action_data.get("type") == "DEBATE/REASONING_NODE":
                    payload = action_data.get("payload", {})
                    if payload.get("nodeType") == "risk_check":
                        risk_check_found = True
                        assert payload["label"] == "Guardian: Safe"
                        assert payload["summary"] == "No issues detected"

            assert risk_check_found

    @pytest.mark.asyncio
    async def test_2_1_int_003_guardian_verdict_at_completion(
        self, mock_manager, mock_stale_guardian
    ):
        # Given: guardian returns safe analysis throughout debate
        # When: stream_debate completes
        # Then: DEBATE/GUARDIAN_VERDICT is broadcast with verdict="Wait"

        with (
            patch("app.services.debate.engine.BullAgent") as mock_bull_class,
            patch("app.services.debate.engine.BearAgent") as mock_bear_class,
            patch("app.services.debate.engine.GuardianAgent") as mock_guardian_class,
            patch("app.services.debate.engine.stream_state") as mock_stream_state,
        ):
            _patch_engine_mocks(
                mock_bull_class, mock_bear_class, mock_guardian_class, mock_stream_state
            )

            safe = make_guardian_result(detailed_reasoning="All clear.")
            mock_guardian = MagicMock()
            mock_guardian.analyze = AsyncMock(return_value=safe.model_dump())
            mock_guardian_class.return_value = mock_guardian

            with patch("app.config.settings") as mock_settings:
                mock_settings.guardian_enabled = True

                await stream_debate(
                    debate_id="test-debate",
                    asset="BTC",
                    market_context={"summary": "test"},
                    manager=mock_manager,
                    max_turns=2,
                    stale_guardian=mock_stale_guardian,
                )

            broadcasts = mock_manager.broadcast_to_debate.call_args_list
            verdict_found = False
            for call in broadcasts:
                action_data = call[0][1]
                if action_data.get("type") == "DEBATE/GUARDIAN_VERDICT":
                    verdict_found = True
                    payload = action_data["payload"]
                    assert payload["verdict"] == "Wait"
                    assert payload["reasoning"] == "All clear."
                    assert payload["totalInterrupts"] == 0

            assert verdict_found

    @pytest.mark.asyncio
    async def test_2_1_int_004_guardian_llm_failure_does_not_crash_debate(
        self, mock_manager, mock_stale_guardian
    ):
        # Given: guardian.analyze raises Exception on every call
        # When: stream_debate runs
        # Then: debate completes with status="completed" and "skipped" risk_check is emitted

        with (
            patch("app.services.debate.engine.BullAgent") as mock_bull_class,
            patch("app.services.debate.engine.BearAgent") as mock_bear_class,
            patch("app.services.debate.engine.GuardianAgent") as mock_guardian_class,
            patch("app.services.debate.engine.stream_state") as mock_stream_state,
        ):
            _patch_engine_mocks(
                mock_bull_class, mock_bear_class, mock_guardian_class, mock_stream_state
            )

            mock_guardian = MagicMock()
            mock_guardian.analyze = AsyncMock(side_effect=Exception("LLM timeout"))
            mock_guardian_class.return_value = mock_guardian

            with patch("app.config.settings") as mock_settings:
                mock_settings.guardian_enabled = True

                result = await stream_debate(
                    debate_id="test-debate",
                    asset="BTC",
                    market_context={"summary": "test"},
                    manager=mock_manager,
                    max_turns=2,
                    stale_guardian=mock_stale_guardian,
                )

            assert result["status"] == "completed"

            broadcasts = mock_manager.broadcast_to_debate.call_args_list
            safe_skipped_found = False
            for call in broadcasts:
                action_data = call[0][1]
                if action_data.get("type") == "DEBATE/REASONING_NODE":
                    payload = action_data.get("payload", {})
                    if payload.get(
                        "nodeType"
                    ) == "risk_check" and "skipped" in payload.get("summary", ""):
                        safe_skipped_found = True

            assert safe_skipped_found

    @pytest.mark.asyncio
    async def test_2_1_int_005_guardian_interrupt_broadcasts_and_accumulates(
        self, mock_manager, mock_stale_guardian
    ):
        # Given: guardian returns interrupt analysis (high risk, overconfidence)
        # When: stream_debate runs
        # Then: DEBATE/GUARDIAN_INTERRUPT is broadcast with correct payload

        interrupt = make_guardian_result(
            should_interrupt=True,
            risk_level="high",
            fallacy_type="overconfidence",
            reason="Treats prediction as certainty.",
            summary_verdict="High Risk",
            safe=False,
            detailed_reasoning="Overconfidence detected.",
        )

        with (
            patch("app.services.debate.engine.BullAgent") as mock_bull_class,
            patch("app.services.debate.engine.BearAgent") as mock_bear_class,
            patch("app.services.debate.engine.GuardianAgent") as mock_guardian_class,
            patch("app.services.debate.engine.stream_state") as mock_stream_state,
        ):
            _patch_engine_mocks(
                mock_bull_class, mock_bear_class, mock_guardian_class, mock_stream_state
            )

            mock_guardian = MagicMock()
            mock_guardian.analyze = AsyncMock(return_value=interrupt.model_dump())
            mock_guardian_class.return_value = mock_guardian

            with patch("app.config.settings") as mock_settings:
                mock_settings.guardian_enabled = True

                await stream_debate(
                    debate_id="test-debate",
                    asset="BTC",
                    market_context={"summary": "test"},
                    manager=mock_manager,
                    max_turns=2,
                    stale_guardian=mock_stale_guardian,
                )

            broadcasts = mock_manager.broadcast_to_debate.call_args_list
            interrupt_found = False
            for call in broadcasts:
                action_data = call[0][1]
                if action_data.get("type") == "DEBATE/GUARDIAN_INTERRUPT":
                    interrupt_found = True
                    payload = action_data["payload"]
                    assert payload["riskLevel"] == "high"
                    assert payload["fallacyType"] == "overconfidence"

            assert interrupt_found

    @pytest.mark.asyncio
    async def test_2_1_int_006_guardian_disabled_skips_analysis(
        self, mock_manager, mock_stale_guardian
    ):
        # Given: guardian_enabled = False
        # When: stream_debate runs
        # Then: GuardianAgent is never instantiated, no guardian broadcasts occur

        with (
            patch("app.services.debate.engine.BullAgent") as mock_bull_class,
            patch("app.services.debate.engine.BearAgent") as mock_bear_class,
            patch("app.services.debate.engine.GuardianAgent") as mock_guardian_class,
            patch("app.services.debate.engine.stream_state") as mock_stream_state,
        ):
            _patch_engine_mocks(
                mock_bull_class, mock_bear_class, mock_guardian_class, mock_stream_state
            )

            with patch("app.config.settings") as mock_settings:
                mock_settings.guardian_enabled = False

                result = await stream_debate(
                    debate_id="test-debate",
                    asset="BTC",
                    market_context={"summary": "test"},
                    manager=mock_manager,
                    max_turns=2,
                    stale_guardian=mock_stale_guardian,
                )

            mock_guardian_class.assert_not_called()
            assert result["status"] == "completed"

            broadcasts = mock_manager.broadcast_to_debate.call_args_list
            for call in broadcasts:
                action_data = call[0][1]
                assert action_data.get("type") != "DEBATE/GUARDIAN_INTERRUPT"
                assert action_data.get("type") != "DEBATE/GUARDIAN_VERDICT"
                if action_data.get("type") == "DEBATE/REASONING_NODE":
                    payload = action_data.get("payload", {})
                    assert payload.get("nodeType") != "risk_check"


class TestGuardianVerdictFailureAtDebateEnd:
    @pytest.mark.asyncio
    async def test_2_1_int_007_verdict_failure_defaults_to_caution(
        self, mock_manager, mock_stale_guardian
    ):
        # Given: guardian.analyze raises Exception on every call
        # When: stream_debate completes
        # Then: DEBATE/GUARDIAN_VERDICT defaults to verdict="Caution", summary="Guardian analysis unavailable"

        with (
            patch("app.services.debate.engine.BullAgent") as mock_bull_class,
            patch("app.services.debate.engine.BearAgent") as mock_guardian_class_proxy,
            patch("app.services.debate.engine.GuardianAgent") as mock_guardian_class,
            patch("app.services.debate.engine.stream_state") as mock_stream_state,
        ):
            _patch_engine_mocks(
                mock_bull_class,
                mock_guardian_class_proxy,
                mock_guardian_class,
                mock_stream_state,
            )

            mock_guardian = MagicMock()
            mock_guardian.analyze = AsyncMock(
                side_effect=Exception("Final verdict LLM crashed")
            )
            mock_guardian_class.return_value = mock_guardian

            with patch("app.config.settings") as mock_settings:
                mock_settings.guardian_enabled = True

                result = await stream_debate(
                    debate_id="test-debate",
                    asset="BTC",
                    market_context={"summary": "test"},
                    manager=mock_manager,
                    max_turns=2,
                    stale_guardian=mock_stale_guardian,
                )

            assert result["status"] == "completed"

            broadcasts = mock_manager.broadcast_to_debate.call_args_list
            verdict_found = False
            for call in broadcasts:
                action_data = call[0][1]
                if action_data.get("type") == "DEBATE/GUARDIAN_VERDICT":
                    verdict_found = True
                    payload = action_data["payload"]
                    assert payload["verdict"] == "Caution"
                    assert payload["summary"] == "Guardian analysis unavailable"

            assert verdict_found


class TestMixedSafeInterruptAcrossTurns:
    @pytest.mark.asyncio
    async def test_2_1_int_008_mixed_safe_and_interrupt_turns(
        self, mock_manager, mock_stale_guardian
    ):
        # Given: guardian alternates between interrupt (odd) and safe (even)
        # When: stream_debate runs for 4 turns
        # Then: at least 2 interrupts and at least 1 safe risk_check are broadcast

        interrupt = make_guardian_result(
            should_interrupt=True,
            risk_level="high",
            fallacy_type="overconfidence",
            reason="Overconfidence on odd turns",
            summary_verdict="High Risk",
            safe=False,
            detailed_reasoning="Pattern detected",
        ).model_dump()
        safe = make_guardian_result(
            reason="Safe on even turns",
        ).model_dump()
        mock_analyze_mixed = AsyncMock(
            side_effect=[interrupt, safe, interrupt, safe, interrupt]
        )

        with (
            patch("app.services.debate.engine.BullAgent") as mock_bull_class,
            patch("app.services.debate.engine.BearAgent") as mock_bear_class,
            patch("app.services.debate.engine.GuardianAgent") as mock_guardian_class,
            patch("app.services.debate.engine.stream_state") as mock_stream_state,
        ):
            _patch_engine_mocks(
                mock_bull_class, mock_bear_class, mock_guardian_class, mock_stream_state
            )

            mock_guardian = MagicMock()
            mock_guardian.analyze = mock_analyze_mixed
            mock_guardian_class.return_value = mock_guardian

            with patch("app.config.settings") as mock_settings:
                mock_settings.guardian_enabled = True

                result = await stream_debate(
                    debate_id="test-debate",
                    asset="BTC",
                    market_context={"summary": "test"},
                    manager=mock_manager,
                    max_turns=4,
                    stale_guardian=mock_stale_guardian,
                )

            assert result["status"] == "completed"

            broadcasts = mock_manager.broadcast_to_debate.call_args_list
            interrupt_count = 0
            safe_risk_check_count = 0
            for call in broadcasts:
                action_data = call[0][1]
                if action_data.get("type") == "DEBATE/GUARDIAN_INTERRUPT":
                    interrupt_count += 1
                if action_data.get("type") == "DEBATE/REASONING_NODE":
                    payload = action_data.get("payload", {})
                    if payload.get("nodeType") == "risk_check":
                        if "Guardian: Safe" in payload.get("label", ""):
                            safe_risk_check_count += 1

            assert interrupt_count >= 2
            assert safe_risk_check_count >= 1
