import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from app.services.debate.engine import (
    create_debate_graph,
    should_continue,
    bull_agent_node,
    bear_agent_node,
)


class TestDebateEngine:
    @pytest.fixture
    def debate_graph(self):
        return create_debate_graph()

    def test_should_continue_returns_true_when_turns_remaining(self, debate_state):
        debate_state["current_turn"] = 3
        debate_state["max_turns"] = 6

        result = should_continue(debate_state)

        assert result is True

    def test_should_continue_returns_false_at_max_turns(self, debate_state):
        debate_state["current_turn"] = 6
        debate_state["max_turns"] = 6

        result = should_continue(debate_state)

        assert result is False

    def test_should_continue_returns_false_over_max_turns(self, debate_state):
        debate_state["current_turn"] = 7
        debate_state["max_turns"] = 6

        result = should_continue(debate_state)

        assert result is False

    @pytest.mark.asyncio
    async def test_state_transitions_bull_to_bear(self, mock_llm, debate_state):
        with patch("app.services.debate.engine.BullAgent") as mock_bull_class:
            mock_bull = MagicMock()
            mock_bull.generate = AsyncMock(
                return_value={
                    "messages": [{"role": "bull", "content": "Bull argument"}],
                    "current_turn": 1,
                    "current_agent": "bear",
                }
            )
            mock_bull_class.return_value = mock_bull

            result = await bull_agent_node(debate_state)

            assert result["current_agent"] == "bear"
            assert result["current_turn"] == 1

    @pytest.mark.asyncio
    async def test_state_transitions_bear_to_bull(self, mock_llm, debate_state):
        debate_state["messages"] = [{"role": "bull", "content": "Bull argument"}]
        debate_state["current_turn"] = 1
        debate_state["current_agent"] = "bear"

        with patch("app.services.debate.engine.BearAgent") as mock_bear_class:
            mock_bear = MagicMock()
            mock_bear.generate = AsyncMock(
                return_value={
                    "messages": [{"role": "bear", "content": "Bear argument"}],
                    "current_turn": 2,
                    "current_agent": "bull",
                }
            )
            mock_bear_class.return_value = mock_bear

            result = await bear_agent_node(debate_state)

            assert result["current_agent"] == "bull"
            assert result["current_turn"] == 2

    def test_graph_structure(self, debate_graph):
        assert "bull" in debate_graph.nodes
        assert "bear" in debate_graph.nodes

    @pytest.mark.asyncio
    async def test_max_turns_stops_debate(self, mock_llm, mock_market_context):
        with patch("app.services.debate.engine.BullAgent") as mock_bull_class:
            with patch("app.services.debate.engine.BearAgent") as mock_bear_class:
                turn_counter = [0]

                async def mock_bull_generate(state):
                    turn_counter[0] += 1
                    new_message = {
                        "role": "bull",
                        "content": f"Bull turn {turn_counter[0]}",
                    }
                    return {
                        "messages": state["messages"] + [new_message],
                        "current_turn": state["current_turn"] + 1,
                        "current_agent": "bear",
                    }

                async def mock_bear_generate(state):
                    turn_counter[0] += 1
                    new_message = {
                        "role": "bear",
                        "content": f"Bear turn {turn_counter[0]}",
                    }
                    return {
                        "messages": state["messages"] + [new_message],
                        "current_turn": state["current_turn"] + 1,
                        "current_agent": "bull",
                    }

                mock_bull = MagicMock()
                mock_bull.generate = mock_bull_generate
                mock_bull_class.return_value = mock_bull

                mock_bear = MagicMock()
                mock_bear.generate = mock_bear_generate
                mock_bear_class.return_value = mock_bear

                graph = create_debate_graph()
                initial_state = {
                    "asset": "bitcoin",
                    "market_context": mock_market_context.model_dump(),
                    "messages": [],
                    "current_turn": 0,
                    "max_turns": 2,
                    "current_agent": "bull",
                    "status": "running",
                }

                config = {"configurable": {"thread_id": "test-thread"}}
                result = await graph.ainvoke(initial_state, config)

                assert result["current_turn"] >= 2
