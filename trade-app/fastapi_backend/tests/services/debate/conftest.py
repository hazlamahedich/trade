import pytest
from unittest.mock import MagicMock, AsyncMock

from app.services.market.schemas import MarketContext
from app.services.debate.agents.guardian import GuardianAnalysisResult


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


@pytest.fixture
def debate_state_with_arguments(mock_market_context):
    return {
        "asset": "bitcoin",
        "market_context": mock_market_context.model_dump(),
        "messages": [
            {"role": "bull", "content": "Bitcoin is going up based on ETF approval."},
            {"role": "bear", "content": "But regulatory risks remain."},
        ],
        "current_turn": 2,
        "max_turns": 6,
        "current_agent": "bull",
        "status": "running",
    }


@pytest.fixture
def guardian_interrupt_result():
    return GuardianAnalysisResult(
        should_interrupt=True,
        risk_level="high",
        fallacy_type="overconfidence",
        reason="The argument treats a prediction as certainty without evidence.",
        summary_verdict="High Risk",
        safe=False,
        detailed_reasoning="Overconfidence detected in the bull agent's argument.",
    )


@pytest.fixture
def guardian_safe_result():
    return GuardianAnalysisResult(
        should_interrupt=False,
        risk_level="low",
        fallacy_type=None,
        reason="No issues detected.",
        summary_verdict="Wait",
        safe=True,
        detailed_reasoning="",
    )


@pytest.fixture
def mock_guardian_llm(guardian_safe_result):
    structured_mock = MagicMock()
    chain_mock = MagicMock()
    chain_mock.ainvoke = AsyncMock(return_value=guardian_safe_result)
    prompt_mock = MagicMock()
    prompt_mock.__or__ = MagicMock(return_value=chain_mock)
    llm_mock = MagicMock()
    llm_mock.with_structured_output.return_value = structured_mock
    return llm_mock, chain_mock, prompt_mock
