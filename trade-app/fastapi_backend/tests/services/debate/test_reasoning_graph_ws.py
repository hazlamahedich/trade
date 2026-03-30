import pytest
from unittest.mock import AsyncMock

from app.services.debate.streaming import (
    DebateConnectionManager,
    send_reasoning_node,
)
from app.services.debate.ws_schemas import ReasoningNodePayload


class TestReasoningGraphWebSocket:
    @pytest.fixture
    def manager(self):
        return DebateConnectionManager()

    @pytest.fixture
    def mock_websocket(self):
        ws = AsyncMock()
        ws.send_json = AsyncMock()
        return ws

    @pytest.mark.asyncio
    async def test_send_reasoning_node_data_input_format(self, manager, mock_websocket):
        await manager.connect("debate-1", mock_websocket)

        await send_reasoning_node(
            manager,
            "debate-1",
            node_id="data-BTC-abc12345",
            node_type="data_input",
            label="BTC Market Data",
            summary="Market data loaded",
        )

        mock_websocket.send_json.assert_called_once()
        action = mock_websocket.send_json.call_args[0][0]
        assert action["type"] == "DEBATE/REASONING_NODE"
        assert action["payload"]["debateId"] == "debate-1"
        assert action["payload"]["nodeId"] == "data-BTC-abc12345"
        assert action["payload"]["nodeType"] == "data_input"
        assert action["payload"]["label"] == "BTC Market Data"
        assert action["payload"]["isWinning"] is False

    @pytest.mark.asyncio
    async def test_send_reasoning_node_bull_analysis(self, manager, mock_websocket):
        await manager.connect("debate-1", mock_websocket)

        await send_reasoning_node(
            manager,
            "debate-1",
            node_id="bull-turn-1",
            node_type="bull_analysis",
            label="Bull Argument #1",
            summary="Strong bullish case",
            agent="bull",
            parent_id="data-BTC-abc12345",
            turn=1,
        )

        action = mock_websocket.send_json.call_args[0][0]
        assert action["payload"]["agent"] == "bull"
        assert action["payload"]["parentId"] == "data-BTC-abc12345"
        assert action["payload"]["turn"] == 1

    @pytest.mark.asyncio
    async def test_send_reasoning_node_bear_counter_type(self, manager, mock_websocket):
        await manager.connect("debate-1", mock_websocket)

        await send_reasoning_node(
            manager,
            "debate-1",
            node_id="bear-turn-1",
            node_type="bear_counter",
            label="Bear Counter #1",
            summary="Bearish counter",
            agent="bear",
            parent_id="bull-turn-1",
            turn=1,
        )

        action = mock_websocket.send_json.call_args[0][0]
        assert action["payload"]["nodeType"] == "bear_counter"

    @pytest.mark.asyncio
    async def test_send_reasoning_node_winning_path(self, manager, mock_websocket):
        await manager.connect("debate-1", mock_websocket)

        await send_reasoning_node(
            manager,
            "debate-1",
            node_id="bull-turn-1",
            node_type="bull_analysis",
            label="Bull Argument #1",
            summary="",
            agent="bull",
            is_winning=True,
            turn=1,
        )

        action = mock_websocket.send_json.call_args[0][0]
        assert action["payload"]["isWinning"] is True

    @pytest.mark.asyncio
    async def test_send_reasoning_node_camelcase_output(self, manager, mock_websocket):
        await manager.connect("debate-1", mock_websocket)

        await send_reasoning_node(
            manager,
            "debate-1",
            node_id="node-1",
            node_type="data_input",
            label="Test",
            summary="Test",
            parent_id="parent-1",
            is_winning=True,
        )

        action = mock_websocket.send_json.call_args[0][0]
        assert "debateId" in action["payload"]
        assert "nodeId" in action["payload"]
        assert "nodeType" in action["payload"]
        assert "parentId" in action["payload"]
        assert "isWinning" in action["payload"]

    @pytest.mark.asyncio
    async def test_send_reasoning_node_risk_check_placeholder(
        self, manager, mock_websocket
    ):
        await manager.connect("debate-1", mock_websocket)

        await send_reasoning_node(
            manager,
            "debate-1",
            node_id="risk-check-1",
            node_type="risk_check",
            label="Risk Assessment",
            summary="Pending guardian...",
        )

        action = mock_websocket.send_json.call_args[0][0]
        assert action["payload"]["nodeType"] == "risk_check"
        assert action["payload"]["agent"] is None


class TestReasoningNodePayloadModel:
    def test_basic_data_input_payload(self):
        payload = ReasoningNodePayload(
            debate_id="debate-1",
            node_id="data-BTC-abc12345",
            node_type="data_input",
            label="BTC Market Data",
            summary="Market data loaded",
        )
        assert payload.debate_id == "debate-1"
        assert payload.node_id == "data-BTC-abc12345"
        assert payload.node_type == "data_input"
        assert payload.agent is None
        assert payload.parent_id is None
        assert payload.is_winning is False
        assert payload.turn is None

    def test_full_agent_payload(self):
        payload = ReasoningNodePayload(
            debate_id="debate-1",
            node_id="bull-turn-1",
            node_type="bull_analysis",
            label="Bull Argument #1",
            summary="Strong bullish case...",
            agent="bull",
            parent_id="data-BTC-abc12345",
            is_winning=True,
            turn=1,
        )
        assert payload.agent == "bull"
        assert payload.parent_id == "data-BTC-abc12345"
        assert payload.is_winning is True
        assert payload.turn == 1

    def test_camelcase_serialization(self):
        payload = ReasoningNodePayload(
            debate_id="debate-1",
            node_id="node-1",
            node_type="bull_analysis",
            label="Test",
            summary="Test summary",
            parent_id="parent-1",
            is_winning=True,
        )
        serialized = payload.model_dump(by_alias=True)
        assert "debateId" in serialized
        assert "nodeId" in serialized
        assert "nodeType" in serialized
        assert "parentId" in serialized
        assert "isWinning" in serialized

    def test_bear_counter_node_type(self):
        payload = ReasoningNodePayload(
            debate_id="debate-1",
            node_id="bear-turn-1",
            node_type="bear_counter",
            label="Bear Counter #1",
            summary="Bearish counter",
            agent="bear",
        )
        assert payload.node_type == "bear_counter"
