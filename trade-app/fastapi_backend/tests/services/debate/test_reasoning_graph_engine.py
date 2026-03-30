import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.debate.engine import stream_debate, StaleDataError
from app.services.debate.streaming import DebateConnectionManager


DEBATE_ID = "debate-abc12345-def6-7890"
ASSET = "BTC"
SHORT_ID = DEBATE_ID[:8]


@pytest.fixture
def manager():
    return DebateConnectionManager()


@pytest.fixture
def mock_stale_guardian():
    guardian = MagicMock()
    freshness = MagicMock()
    freshness.is_stale = False
    freshness.age_seconds = 5
    freshness.last_update = None
    guardian.get_freshness_status = AsyncMock(return_value=freshness)
    return guardian


@pytest.fixture
def market_context():
    return {"summary": "BTC trending upward", "price": 50000.0}


@pytest.fixture
def mock_bull_result():
    return {
        "messages": [
            {"role": "bull", "content": "Strong momentum signals"},
        ],
        "current_turn": 1,
        "current_agent": "bear",
    }


@pytest.fixture
def mock_bear_result():
    return {
        "messages": [
            {"role": "bull", "content": "Strong momentum signals"},
            {"role": "bear", "content": "Overbought RSI divergence"},
        ],
        "current_turn": 2,
        "current_agent": "bull",
    }


async def _run_stream_debate(
    manager,
    mock_stale_guardian,
    market_context,
    mock_bull_result,
    mock_bear_result,
    max_turns=2,
):
    captured = []

    async def capture_send_reasoning_node(mgr, debate_id, **kwargs):
        captured.append(kwargs)

    with (
        patch(
            "app.services.debate.engine.bull_agent_node",
            new=AsyncMock(return_value=mock_bull_result),
        ) as mock_bull,
        patch(
            "app.services.debate.engine.bear_agent_node",
            new=AsyncMock(return_value=mock_bear_result),
        ) as mock_bear,
        patch(
            "app.services.debate.engine.send_reasoning_node",
            side_effect=capture_send_reasoning_node,
        ) as mock_send_node,
        patch(
            "app.services.debate.engine.send_status_update",
            new=AsyncMock(),
        ),
        patch("app.services.debate.engine.stream_state") as mock_stream_state,
    ):
        mock_stream_state.save_state = AsyncMock()

        result = await stream_debate(
            debate_id=DEBATE_ID,
            asset=ASSET,
            market_context=market_context,
            manager=manager,
            max_turns=max_turns,
            stale_guardian=mock_stale_guardian,
        )

    return result, captured, mock_bull, mock_bear


class TestReasoningGraphEngineLifecycle:
    @pytest.mark.asyncio
    async def test_1_7_unit_020_data_input_node_emitted_before_loop(
        self,
        manager,
        mock_stale_guardian,
        market_context,
        mock_bull_result,
        mock_bear_result,
    ):
        result, captured, _, _ = await _run_stream_debate(
            manager,
            mock_stale_guardian,
            market_context,
            mock_bull_result,
            mock_bear_result,
        )

        data_nodes = [n for n in captured if n.get("node_type") == "data_input"]
        assert len(data_nodes) == 1

        data_node = data_nodes[0]
        assert data_node["node_id"] == f"data-{ASSET}-{SHORT_ID}"
        assert data_node["label"] == f"{ASSET} Market Data"
        assert data_node["summary"] == market_context["summary"]
        assert data_node.get("agent") is None
        assert data_node.get("is_winning") is not True

        assert captured[0]["node_type"] == "data_input"

    @pytest.mark.asyncio
    async def test_1_7_unit_021_agent_node_types_correct(
        self,
        manager,
        mock_stale_guardian,
        market_context,
        mock_bull_result,
        mock_bear_result,
    ):
        result, captured, _, _ = await _run_stream_debate(
            manager,
            mock_stale_guardian,
            market_context,
            mock_bull_result,
            mock_bear_result,
        )

        loop_nodes = [
            n
            for n in captured
            if n.get("node_type") in ("bull_analysis", "bear_counter")
            and not n.get("is_winning")
        ]

        assert loop_nodes[0]["node_type"] == "bull_analysis"
        assert loop_nodes[0]["agent"] == "bull"

        assert loop_nodes[1]["node_type"] == "bear_counter"
        assert loop_nodes[1]["agent"] == "bear"

    @pytest.mark.asyncio
    async def test_1_7_unit_022_winning_path_nodes_after_loop(
        self,
        manager,
        mock_stale_guardian,
        market_context,
        mock_bull_result,
        mock_bear_result,
    ):
        result, captured, _, _ = await _run_stream_debate(
            manager,
            mock_stale_guardian,
            market_context,
            mock_bull_result,
            mock_bear_result,
        )

        winning_nodes = [n for n in captured if n.get("is_winning") is True]
        assert len(winning_nodes) == 4

        winning_ids = {n["node_id"] for n in winning_nodes}
        assert "bull-turn-1" in winning_ids
        assert "bear-turn-1" in winning_ids
        assert "bull-turn-2" in winning_ids
        assert "bear-turn-2" in winning_ids

        for node in winning_nodes:
            assert node["is_winning"] is True

    @pytest.mark.asyncio
    async def test_1_7_unit_023_node_id_naming_convention(
        self,
        manager,
        mock_stale_guardian,
        market_context,
        mock_bull_result,
        mock_bear_result,
    ):
        result, captured, _, _ = await _run_stream_debate(
            manager,
            mock_stale_guardian,
            market_context,
            mock_bull_result,
            mock_bear_result,
        )

        loop_nodes = [
            n
            for n in captured
            if n.get("node_type") in ("bull_analysis", "bear_counter")
            and not n.get("is_winning")
        ]

        assert loop_nodes[0]["node_id"] == "bull-turn-1"
        assert loop_nodes[1]["node_id"] == "bear-turn-2"

        data_nodes = [n for n in captured if n.get("node_type") == "data_input"]
        assert data_nodes[0]["node_id"] == f"data-{ASSET}-{SHORT_ID}"

    @pytest.mark.asyncio
    async def test_1_7_unit_024_previous_node_id_linkage(
        self,
        manager,
        mock_stale_guardian,
        market_context,
        mock_bull_result,
        mock_bear_result,
    ):
        result, captured, _, _ = await _run_stream_debate(
            manager,
            mock_stale_guardian,
            market_context,
            mock_bull_result,
            mock_bear_result,
        )

        loop_nodes = [
            n
            for n in captured
            if n.get("node_type") in ("bull_analysis", "bear_counter")
            and not n.get("is_winning")
        ]

        assert loop_nodes[0]["parent_id"] == f"data-{ASSET}-{SHORT_ID}"

        assert loop_nodes[1]["parent_id"] == "bear-turn-1"

    @pytest.mark.asyncio
    async def test_1_7_unit_025_node_emission_order(
        self,
        manager,
        mock_stale_guardian,
        market_context,
        mock_bull_result,
        mock_bear_result,
    ):
        result, captured, _, _ = await _run_stream_debate(
            manager,
            mock_stale_guardian,
            market_context,
            mock_bull_result,
            mock_bear_result,
        )

        emission_order = [n["node_type"] for n in captured]

        assert emission_order[0] == "data_input"

        loop_types = [
            t for t in emission_order if t in ("bull_analysis", "bear_counter")
        ]
        assert loop_types[:2] == ["bull_analysis", "bear_counter"]

        all_winning = [n for n in captured if n.get("is_winning") is True]
        assert len(all_winning) == 4

    @pytest.mark.asyncio
    async def test_1_7_unit_026_stale_data_raises_before_loop(
        self,
        manager,
        market_context,
    ):
        stale_guardian = MagicMock()
        freshness = MagicMock()
        freshness.is_stale = True
        freshness.age_seconds = 300
        freshness.last_update = None
        stale_guardian.get_freshness_status = AsyncMock(return_value=freshness)

        with (
            patch(
                "app.services.debate.engine.send_status_update",
                new=AsyncMock(),
            ),
            patch(
                "app.services.debate.engine.stream_state",
            ) as mock_stream_state,
        ):
            mock_stream_state.save_state = AsyncMock()

            with pytest.raises(StaleDataError) as exc_info:
                await stream_debate(
                    debate_id=DEBATE_ID,
                    asset=ASSET,
                    market_context=market_context,
                    manager=manager,
                    max_turns=2,
                    stale_guardian=stale_guardian,
                )

            assert exc_info.value.code == "DATA_STALE"

    @pytest.mark.asyncio
    async def test_1_7_unit_027_agent_node_summary_truncated(
        self,
        manager,
        mock_stale_guardian,
        market_context,
        mock_bear_result,
    ):
        long_content = "A" * 200
        bull_result = {
            "messages": [
                {"role": "bull", "content": long_content},
            ],
            "current_turn": 1,
            "current_agent": "bear",
        }

        result, captured, _, _ = await _run_stream_debate(
            manager,
            mock_stale_guardian,
            market_context,
            bull_result,
            mock_bear_result,
        )

        loop_nodes = [
            n
            for n in captured
            if n.get("node_type") in ("bull_analysis", "bear_counter")
            and not n.get("is_winning")
        ]

        assert len(loop_nodes[0]["summary"]) == 100
        assert loop_nodes[0]["summary"] == long_content[:100]

    @pytest.mark.asyncio
    async def test_1_7_unit_028_winning_nodes_include_both_agents_per_turn(
        self,
        manager,
        mock_stale_guardian,
        market_context,
        mock_bull_result,
        mock_bear_result,
    ):
        result, captured, _, _ = await _run_stream_debate(
            manager,
            mock_stale_guardian,
            market_context,
            mock_bull_result,
            mock_bear_result,
        )

        winning_nodes = [n for n in captured if n.get("is_winning") is True]

        turn_1_nodes = [n for n in winning_nodes if n.get("turn") == 1]
        turn_2_nodes = [n for n in winning_nodes if n.get("turn") == 2]

        assert len(turn_1_nodes) == 2
        assert len(turn_2_nodes) == 2

        turn_1_agents = {n["agent"] for n in turn_1_nodes}
        assert turn_1_agents == {"bull", "bear"}

    @pytest.mark.asyncio
    async def test_1_7_unit_029_final_state_completed(
        self,
        manager,
        mock_stale_guardian,
        market_context,
        mock_bull_result,
        mock_bear_result,
    ):
        result, captured, _, _ = await _run_stream_debate(
            manager,
            mock_stale_guardian,
            market_context,
            mock_bull_result,
            mock_bear_result,
        )

        assert result["status"] == "completed"
        assert result["current_turn"] == 2
        assert result["asset"] == ASSET
