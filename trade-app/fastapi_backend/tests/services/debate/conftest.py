import pytest
from unittest.mock import MagicMock

from app.services.market.schemas import MarketContext


@pytest.fixture
def mock_llm():
    response_mock = MagicMock()
    response_mock.content = "Test argument"

    chain_mock = MagicMock()
    chain_mock.invoke.return_value = response_mock

    prompt_mock = MagicMock()
    prompt_mock.__or__ = MagicMock(return_value=chain_mock)
    return prompt_mock, response_mock


@pytest.fixture
def mock_market_context():
    return MarketContext(
        asset="bitcoin",
        price=45000.0,
        news_summary=["Bitcoin ETF approved"],
        is_stale=False,
    )


@pytest.fixture
def stale_market_context():
    return MarketContext(
        asset="bitcoin",
        price=45000.0,
        news_summary=["Bitcoin ETF approved"],
        is_stale=True,
    )


@pytest.fixture
def debate_state(mock_market_context):
    return {
        "asset": "bitcoin",
        "market_context": mock_market_context.model_dump(),
        "messages": [],
        "current_turn": 0,
        "max_turns": 6,
        "current_agent": "bull",
        "status": "running",
    }
