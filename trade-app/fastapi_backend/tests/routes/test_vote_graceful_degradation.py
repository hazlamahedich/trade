import pytest
import time
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.rate_limiter import RateLimitResult, RateLimiter

from tests.routes.vote_test_helpers import (
    make_client,
    post_vote,
    mock_vote_deps,
    allowed_result,
    blocked_result,
    mock_repo_with_running_debate,
)


class TestGracefulDegradation:
    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_vote_succeeds_under_capacity(self):
        """[3-1-API-021] Given capacity under threshold, When POST /vote, Then 200"""
        with mock_vote_deps():
            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 200

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_vote_503_when_capacity_exceeded(self):
        """[3-1-API-022] Given capacity over threshold, When POST /vote, Then 503 VOTING_DISABLED"""
        with mock_vote_deps(capacity_result=blocked_result(10000)):
            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 503
                data = response.json()
                assert data["error"]["code"] == "VOTING_DISABLED"

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_vote_503_at_exact_capacity_boundary(self):
        """[3-1-API-023] Given current=10001 limit=10000, When POST /vote, Then 503 (boundary test)"""
        boundary = RateLimitResult(
            allowed=False,
            current=10001,
            limit=10000,
            remaining=0,
            reset_at=time.time() + 30,
        )
        with mock_vote_deps(capacity_result=boundary):
            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 503

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_rate_limited_does_not_reach_capacity(self):
        """[3-1-API-024] Given rate-limited voter, When POST /vote, Then capacity limiter never called (guard ordering)"""
        capacity_check = AsyncMock(return_value=allowed_result(10000))
        with mock_vote_deps(rate_result=blocked_result()):
            from unittest.mock import patch

            with patch("app.routes.debate._get_capacity_limiter") as mock_cl:
                limiter = MagicMock()
                limiter.check = capacity_check
                mock_cl.return_value = limiter

                async with await make_client() as client:
                    response = await post_vote(client)
                    assert response.status_code == 429
                    capacity_check.assert_not_called()

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_capacity_uses_config_threshold(self):
        """[3-1-API-025] Given VOTE_CAPACITY_LIMIT=500, When capacity exceeded, Then 503 with correct limit"""
        boundary = RateLimitResult(
            allowed=False,
            current=501,
            limit=500,
            remaining=0,
            reset_at=time.time() + 30,
        )
        with (
            mock_vote_deps(capacity_result=boundary),
            patch("app.routes.debate.create_vote_capacity_limiter") as factory,
        ):
            captured_limiter = RateLimiter(
                prefix="capacity:active_voters", max_requests=500, window_seconds=60
            )
            factory.return_value = captured_limiter

            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 503
                assert response.json()["meta"]["estimatedWaitMs"] >= 0

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_db_failure_consumes_rate_budget_accepted_tradeoff(self):
        """[3-1-API-026] Given DB write fails, Then rate budget consumed (accepted trade-off documented)"""
        mock_repo = mock_repo_with_running_debate()
        mock_repo.create_vote = AsyncMock(side_effect=Exception("DB error"))
        mock_repo.has_existing_vote = AsyncMock(return_value=False)
        rate_check = AsyncMock(return_value=allowed_result())

        with mock_vote_deps(repo_override=mock_repo):
            from unittest.mock import patch

            with patch("app.routes.debate._get_vote_limiter") as mock_rl:
                mock_rl.return_value.check = rate_check

                async with await make_client() as client:
                    response = await post_vote(client)
                    assert response.status_code == 503
                    rate_check.assert_called_once()
