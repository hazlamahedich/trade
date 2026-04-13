from uuid import UUID, uuid4
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime, timezone

import pytest

from app.models import Debate
from app.services.market.schemas import MarketContext, FreshnessStatus
from app.services.debate.agents.guardian import GuardianAnalysisResult
from app.services.debate.repository import DebateRepository


SAMPLE_ARCHIVAL_STATE = {
    "debate_id": "deb_test123",
    "asset": "bitcoin",
    "status": "completed",
    "messages": [
        {"role": "bull", "content": "Bitcoin going up!"},
        {"role": "bear", "content": "Regulatory risks ahead."},
    ],
    "current_turn": 2,
    "max_turns": 6,
    "guardian_verdict": "Caution",
    "guardian_interrupts": [{"turn": 1, "reason": "test"}],
    "paused": False,
    "pause_history": [],
}


def mock_execute_result(rows):
    result = MagicMock()
    result.__iter__ = MagicMock(return_value=iter(rows))
    return result


async def create_votes(
    repo: DebateRepository,
    debate_id: UUID,
    debate_external_id: str,
    choices: list[str],
    prefix: str = "fp",
) -> None:
    for i, choice in enumerate(choices):
        await repo.create_vote(
            debate_id=debate_id,
            debate_external_id=debate_external_id,
            choice=choice,
            voter_fingerprint=f"{prefix}_{uuid4().hex[:8]}_{i}",
        )


def make_guardian_result(**overrides):
    defaults = dict(
        should_interrupt=False,
        risk_level="low",
        fallacy_type=None,
        reason="No issues detected.",
        summary_verdict="Wait",
        safe=True,
        detailed_reasoning="",
    )
    return GuardianAnalysisResult(**{**defaults, **overrides})


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
    return make_guardian_result(
        should_interrupt=True,
        risk_level="high",
        fallacy_type="overconfidence",
        reason="The argument treats a prediction as certainty without evidence.",
        safe=False,
        detailed_reasoning="Overconfidence detected in the bull agent argument.",
        summary_verdict="High Risk",
    )


@pytest.fixture
def guardian_safe_result():
    return make_guardian_result()


@pytest.fixture
def mock_manager():
    manager = MagicMock()
    manager.broadcast_to_debate = AsyncMock()
    manager.active_debates = {}
    return manager


@pytest.fixture
def mock_stale_guardian():
    fresh_status = FreshnessStatus(
        asset="BTC",
        is_stale=False,
        last_update=datetime.now(timezone.utc),
        age_seconds=5,
        threshold_seconds=60,
    )
    guardian = MagicMock()
    guardian.get_freshness_status = AsyncMock(return_value=fresh_status)
    return guardian


@pytest.fixture
def mock_agents_with_generate():
    async def bull_gen(state):
        return {
            "messages": state["messages"] + [{"role": "bull", "content": "Bull arg"}],
            "current_turn": state["current_turn"] + 1,
            "current_agent": "bear",
        }

    async def bear_gen(state):
        return {
            "messages": state["messages"] + [{"role": "bear", "content": "Bear arg"}],
            "current_turn": state["current_turn"] + 1,
            "current_agent": "bull",
        }

    mock_bull = MagicMock()
    mock_bull.generate = bull_gen
    mock_bear = MagicMock()
    mock_bear.generate = bear_gen
    return mock_bull, mock_bear


@pytest.fixture
def mock_pause_event():
    import asyncio

    return asyncio.Event()


@pytest.fixture
def guardian_interrupt_payload():
    return {
        "risk_level": "high",
        "reason": "Overconfidence detected in argument.",
        "fallacy_type": "overconfidence",
        "summary_verdict": "High Risk",
    }


@pytest.fixture
def debate_paused_payload():
    return {
        "debate_id": "deb_test123",
        "reason": "Overconfidence detected in argument.",
        "risk_level": "high",
        "summary_verdict": "High Risk",
        "turn": 1,
    }


@pytest.fixture
def critical_guardian_result():
    return make_guardian_result(
        should_interrupt=True,
        risk_level="critical",
        fallacy_type="dangerous_advice",
        reason="Extremely dangerous advice detected.",
        safe=False,
        detailed_reasoning="Dangerous advice detected in the argument.",
        summary_verdict="High Risk",
    )


# --- Archival test fixtures (Story 4.1) ---


@pytest.fixture
def mock_archival_repo():
    repo = MagicMock(spec=DebateRepository)
    repo.get_by_external_id = AsyncMock()
    repo.get_by_external_id_for_update = AsyncMock()
    repo.complete_debate = AsyncMock()
    return repo


@pytest.fixture
def mock_archival_session():
    session = MagicMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    return session


@pytest.fixture
def debate_not_archived():
    debate = MagicMock(spec=Debate)
    debate.id = uuid4()
    debate.completed_at = None
    return debate


@pytest.fixture
def debate_already_archived():
    debate = MagicMock(spec=Debate)
    debate.id = uuid4()
    debate.completed_at = datetime.now(timezone.utc)
    return debate


@pytest.fixture
def archival_mocks(mock_archival_repo, mock_archival_session):
    from contextlib import ExitStack

    with ExitStack() as stack:
        mock_sf = stack.enter_context(
            patch("app.services.debate.archival.async_session_maker")
        )
        mock_sf.return_value.__aenter__ = AsyncMock(return_value=mock_archival_session)
        mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)

        stack.enter_context(
            patch(
                "app.services.debate.archival.DebateRepository",
                return_value=mock_archival_repo,
            )
        )

        mock_ss = stack.enter_context(
            patch("app.services.debate.archival.stream_state")
        )
        mock_ss.delete_state = AsyncMock()

        yield {
            "session_factory": mock_sf,
            "stream_state": mock_ss,
            "repo": mock_archival_repo,
            "session": mock_archival_session,
        }
