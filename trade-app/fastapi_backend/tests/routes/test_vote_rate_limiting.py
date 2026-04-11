import pytest
import time

from app.services.rate_limiter import RateLimitResult

from tests.routes.vote_test_helpers import (
    make_client,
    post_vote,
    mock_vote_deps,
    blocked_result,
)


class TestRateLimitedVote:
    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_vote_succeeds_under_rate_limit(self):
        """[3-1-API-014] Given voter under rate limit, When POST /vote, Then 200"""
        with mock_vote_deps():
            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 200

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_vote_returns_429_when_rate_limited(self):
        """[3-1-API-015] Given voter at limit+1, When POST /vote, Then 429 RATE_LIMITED"""
        with mock_vote_deps(rate_result=blocked_result()):
            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 429
                data = response.json()
                assert data["error"]["code"] == "RATE_LIMITED"

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_vote_429_at_exact_boundary(self):
        """[3-1-API-016] Given current=31 limit=30, When POST /vote, Then 429 (boundary test)"""
        boundary = RateLimitResult(
            allowed=False,
            current=31,
            limit=30,
            remaining=0,
            reset_at=time.time() + 30,
        )
        with mock_vote_deps(rate_result=boundary):
            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 429

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_vote_succeeds_with_allowed_rate_limiter_result(self):
        """[3-1-API-017] Given rate limiter returns allowed=True (e.g. Redis fail-open), When POST /vote, Then 200"""
        fail_open = RateLimitResult(
            allowed=True, current=0, limit=30, remaining=30, reset_at=time.time() + 60
        )
        with mock_vote_deps(rate_result=fail_open):
            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 200

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_vote_succeeds_with_allowed_capacity_limiter_result(self):
        """[3-1-API-018] Given capacity limiter returns allowed=True (e.g. Redis fail-open), When POST /vote, Then 200"""
        fail_open = RateLimitResult(
            allowed=True,
            current=0,
            limit=10000,
            remaining=10000,
            reset_at=time.time() + 60,
        )
        with mock_vote_deps(capacity_result=fail_open):
            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 200
                data = response.json()
                assert data["data"]["choice"] == "bull"
                assert data["data"]["debateId"] == "deb_test123"
                assert data["data"]["voteId"] is not None
                assert data["data"]["voterFingerprint"] == "fp_123"
                assert "createdAt" in data["data"]
                assert data["error"] is None
                assert data["meta"]["isFinal"] is True
                assert "latencyMs" in data["meta"]

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_retry_after_ms_accurate(self):
        """[3-1-API-019] Given rate-limited response, When meta.retryAfterMs present, Then value accurate within 500ms"""
        reset_at = time.time() + 25.5
        blocked = RateLimitResult(
            allowed=False, current=31, limit=30, remaining=0, reset_at=reset_at
        )
        with mock_vote_deps(rate_result=blocked):
            async with await make_client() as client:
                response = await post_vote(client)
                data = response.json()
                assert "retryAfterMs" in data["meta"]
                assert abs(data["meta"]["retryAfterMs"] - 25500) < 500

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_rate_limit_envelope_top_level(self):
        """[3-1-API-020] Given rate-limited response, When JSON returned, Then envelope at top level not nested"""
        with mock_vote_deps(rate_result=blocked_result()):
            async with await make_client() as client:
                response = await post_vote(client)
                data = response.json()
                assert "data" in data
                assert "error" in data
                assert "meta" in data
                assert "detail" not in data
