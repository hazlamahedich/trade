import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from tests.routes.vote_test_helpers import (
    make_client,
    post_vote,
    mock_vote_deps,
    blocked_result,
)


def _make_connection_manager_mock(connection_count: int = 1) -> MagicMock:
    manager = MagicMock()
    manager.broadcast_to_debate = AsyncMock()
    manager.get_connection_count = MagicMock(return_value=connection_count)
    return manager


def _make_result_response(
    total_votes: int = 5, breakdown: dict | None = None
) -> MagicMock:
    result = MagicMock()
    result.total_votes = total_votes
    result.vote_breakdown = breakdown or {"bull": 3, "bear": 2}
    return result


@pytest.mark.asyncio
async def test_successful_vote_triggers_broadcast():
    mock_cm = _make_connection_manager_mock(connection_count=1)
    mock_result = _make_result_response(total_votes=5, breakdown={"bull": 3, "bear": 2})

    with (
        patch("app.services.debate.streaming.connection_manager", mock_cm),
        mock_vote_deps() as deps,
    ):
        deps["repo"].return_value.get_result = AsyncMock(return_value=mock_result)

        async with await make_client() as client:
            response = await post_vote(client)
            assert response.status_code == 200

        mock_cm.broadcast_to_debate.assert_awaited_once()
        call_args = mock_cm.broadcast_to_debate.call_args
        action = call_args[0][1]
        assert action["type"] == "DEBATE/VOTE_UPDATE"
        assert action["payload"]["totalVotes"] == 5
        assert action["payload"]["voteBreakdown"] == {"bull": 3, "bear": 2}
        assert action["payload"]["debateId"] == "deb_test123"
        assert "timestamp" in action


@pytest.mark.asyncio
async def test_broadcast_failure_does_not_fail_vote():
    mock_cm = _make_connection_manager_mock(connection_count=1)
    mock_cm.broadcast_to_debate = AsyncMock(side_effect=Exception("WS broken"))
    mock_result = _make_result_response()

    with (
        patch("app.services.debate.streaming.connection_manager", mock_cm),
        mock_vote_deps() as deps,
    ):
        deps["repo"].return_value.get_result = AsyncMock(return_value=mock_result)

        async with await make_client() as client:
            response = await post_vote(client)
            assert response.status_code == 200


@pytest.mark.asyncio
async def test_broadcast_timeout_does_not_fail_vote():
    mock_cm = _make_connection_manager_mock(connection_count=1)
    mock_cm.broadcast_to_debate = AsyncMock(side_effect=asyncio.TimeoutError("timeout"))
    mock_result = _make_result_response()

    with (
        patch("app.services.debate.streaming.connection_manager", mock_cm),
        mock_vote_deps() as deps,
    ):
        deps["repo"].return_value.get_result = AsyncMock(return_value=mock_result)

        async with await make_client() as client:
            response = await post_vote(client)
            assert response.status_code == 200


@pytest.mark.asyncio
async def test_broadcast_payload_contains_aggregate_counts():
    mock_cm = _make_connection_manager_mock(connection_count=1)
    mock_result = _make_result_response(
        total_votes=10, breakdown={"bull": 7, "bear": 3}
    )

    with (
        patch("app.services.debate.streaming.connection_manager", mock_cm),
        mock_vote_deps() as deps,
    ):
        deps["repo"].return_value.get_result = AsyncMock(return_value=mock_result)

        async with await make_client() as client:
            response = await post_vote(client)
            assert response.status_code == 200

        action = mock_cm.broadcast_to_debate.call_args[0][1]
        assert action["type"] == "DEBATE/VOTE_UPDATE"
        assert action["payload"]["totalVotes"] == 10
        assert action["payload"]["voteBreakdown"] == {"bull": 7, "bear": 3}
        assert action["payload"]["debateId"] == "deb_test123"
        assert "timestamp" in action
        assert isinstance(action["timestamp"], str)


@pytest.mark.asyncio
async def test_no_broadcast_on_duplicate_vote():
    mock_cm = _make_connection_manager_mock(connection_count=1)

    with (
        patch("app.services.debate.streaming.connection_manager", mock_cm),
        mock_vote_deps(has_existing=True),
    ):
        async with await make_client() as client:
            response = await post_vote(client)
            assert response.status_code == 409

        mock_cm.broadcast_to_debate.assert_not_awaited()


@pytest.mark.asyncio
async def test_no_broadcast_on_rate_limit():
    mock_cm = _make_connection_manager_mock(connection_count=1)

    with (
        patch("app.services.debate.streaming.connection_manager", mock_cm),
        mock_vote_deps(rate_result=blocked_result()),
    ):
        async with await make_client() as client:
            response = await post_vote(client)
            assert response.status_code == 429

        mock_cm.broadcast_to_debate.assert_not_awaited()


@pytest.mark.asyncio
async def test_broadcast_action_type_has_debate_prefix():
    mock_cm = _make_connection_manager_mock(connection_count=1)
    mock_result = _make_result_response()

    with (
        patch("app.services.debate.streaming.connection_manager", mock_cm),
        mock_vote_deps() as deps,
    ):
        deps["repo"].return_value.get_result = AsyncMock(return_value=mock_result)

        async with await make_client() as client:
            response = await post_vote(client)
            assert response.status_code == 200

        action = mock_cm.broadcast_to_debate.call_args[0][1]
        assert action["type"] == "DEBATE/VOTE_UPDATE"
        assert action["type"].startswith("DEBATE/")


@pytest.mark.asyncio
async def test_concurrent_votes_both_succeed_and_broadcast():
    mock_cm = _make_connection_manager_mock(connection_count=1)
    mock_result = _make_result_response(total_votes=2)

    with (
        patch("app.services.debate.streaming.connection_manager", mock_cm),
        mock_vote_deps() as deps,
    ):
        deps["repo"].return_value.get_result = AsyncMock(return_value=mock_result)

        async with await make_client() as client:
            results = await asyncio.gather(
                post_vote(
                    client,
                    {
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_concurrent_1",
                    },
                ),
                post_vote(
                    client,
                    {
                        "debate_id": "deb_test123",
                        "choice": "bear",
                        "voter_fingerprint": "fp_concurrent_2",
                    },
                ),
            )

        assert results[0].status_code == 200
        assert results[1].status_code == 200
        assert mock_cm.broadcast_to_debate.await_count == 2


@pytest.mark.asyncio
async def test_no_broadcast_when_no_ws_clients():
    mock_cm = _make_connection_manager_mock(connection_count=0)
    mock_result = _make_result_response()

    with (
        patch("app.services.debate.streaming.connection_manager", mock_cm),
        mock_vote_deps() as deps,
    ):
        deps["repo"].return_value.get_result = AsyncMock(return_value=mock_result)

        async with await make_client() as client:
            response = await post_vote(client)
            assert response.status_code == 200

        mock_cm.broadcast_to_debate.assert_not_awaited()
        deps["repo"].return_value.get_result.assert_not_awaited()


@pytest.mark.asyncio
async def test_no_broadcast_when_get_result_returns_none():
    mock_cm = _make_connection_manager_mock(connection_count=1)

    with (
        patch("app.services.debate.streaming.connection_manager", mock_cm),
        mock_vote_deps() as deps,
    ):
        deps["repo"].return_value.get_result = AsyncMock(return_value=None)

        async with await make_client() as client:
            response = await post_vote(client)
            assert response.status_code == 200

        mock_cm.broadcast_to_debate.assert_not_awaited()


@pytest.mark.asyncio
async def test_broadcast_payload_includes_undecided_votes():
    mock_cm = _make_connection_manager_mock(connection_count=1)
    mock_result = _make_result_response(
        total_votes=10, breakdown={"bull": 4, "bear": 3, "undecided": 3}
    )

    with (
        patch("app.services.debate.streaming.connection_manager", mock_cm),
        mock_vote_deps() as deps,
    ):
        deps["repo"].return_value.get_result = AsyncMock(return_value=mock_result)

        async with await make_client() as client:
            response = await post_vote(client)
            assert response.status_code == 200

        action = mock_cm.broadcast_to_debate.call_args[0][1]
        assert action["type"] == "DEBATE/VOTE_UPDATE"
        assert action["payload"]["totalVotes"] == 10
        assert action["payload"]["voteBreakdown"] == {
            "bull": 4,
            "bear": 3,
            "undecided": 3,
        }
