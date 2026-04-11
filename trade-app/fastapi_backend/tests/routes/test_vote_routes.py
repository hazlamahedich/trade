import pytest
import time
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone
from uuid import uuid4

from app.main import app
from app.services.debate.vote_schemas import VoteResponse
from app.services.rate_limiter import RateLimitResult


def _make_debate(
    external_id: str = "deb_test123", asset: str = "bitcoin", **kwargs
) -> MagicMock:
    d = MagicMock()
    d.id = uuid4()
    d.external_id = external_id
    d.asset = asset
    d.status = kwargs.get("status", "running")
    d.current_turn = kwargs.get("current_turn", 6)
    d.max_turns = kwargs.get("max_turns", 6)
    d.guardian_verdict = kwargs.get("guardian_verdict", "Caution")
    d.guardian_interrupts_count = kwargs.get("guardian_interrupts_count", 2)
    d.transcript = kwargs.get("transcript", None)
    d.created_at = kwargs.get("created_at", datetime.now(timezone.utc))
    d.completed_at = kwargs.get("completed_at", datetime.now(timezone.utc))
    return d


def _allowed_result(limit: int = 30) -> RateLimitResult:
    return RateLimitResult(
        allowed=True,
        current=1,
        limit=limit,
        remaining=limit - 1,
        reset_at=time.time() + 60,
    )


def _blocked_result(limit: int = 30) -> RateLimitResult:
    return RateLimitResult(
        allowed=False,
        current=limit + 1,
        limit=limit,
        remaining=0,
        reset_at=time.time() + 30,
    )


def _mock_repo_with_running_debate(
    has_existing: bool = False, vote_resp: VoteResponse | None = None
) -> AsyncMock:
    mock_repo = AsyncMock()
    mock_repo.get_by_external_id = AsyncMock(
        return_value=_make_debate(status="running")
    )
    mock_repo.has_existing_vote = AsyncMock(return_value=has_existing)
    mock_repo.create_vote = AsyncMock(
        return_value=vote_resp
        or VoteResponse(
            vote_id=str(uuid4()),
            debate_id="deb_test123",
            choice="bull",
            voter_fingerprint="fp_123",
        )
    )
    return mock_repo


class TestGetDebateResult:
    @pytest.mark.asyncio
    async def test_result_found(self):
        from app.services.debate.vote_schemas import DebateResultResponse

        mock_result = DebateResultResponse(
            debate_id="deb_test123",
            asset="bitcoin",
            status="completed",
            current_turn=6,
            max_turns=6,
            guardian_verdict="Caution",
            guardian_interrupts_count=2,
            created_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
            total_votes=8,
            vote_breakdown={"bull": 5, "bear": 3},
        )

        with patch("app.routes.debate.DebateRepository") as MockRepo:
            mock_repo = AsyncMock()
            mock_repo.get_result = AsyncMock(return_value=mock_result)
            MockRepo.return_value = mock_repo

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.get("/api/debate/deb_test123/result")

                assert response.status_code == 200
                data = response.json()
                assert data["data"]["debateId"] == "deb_test123"
                assert data["data"]["asset"] == "bitcoin"
                assert data["data"]["status"] == "completed"
                assert data["data"]["guardianVerdict"] == "Caution"
                assert data["data"]["guardianInterruptsCount"] == 2
                assert data["data"]["totalVotes"] == 8
                assert data["data"]["voteBreakdown"]["bull"] == 5
                assert data["error"] is None
                assert "latencyMs" in data["meta"]

    @pytest.mark.asyncio
    async def test_result_not_found(self):
        with patch("app.routes.debate.DebateRepository") as MockRepo:
            mock_repo = AsyncMock()
            mock_repo.get_result = AsyncMock(return_value=None)
            MockRepo.return_value = mock_repo

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.get("/api/debate/deb_nonexistent/result")

                assert response.status_code == 404
                data = response.json()
                assert data["error"]["code"] == "DEBATE_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_result_running_debate(self):
        from app.services.debate.vote_schemas import DebateResultResponse

        mock_result = DebateResultResponse(
            debate_id="deb_running",
            asset="eth",
            status="running",
            current_turn=3,
            max_turns=6,
            created_at=datetime.now(timezone.utc),
            total_votes=0,
            vote_breakdown={},
        )

        with patch("app.routes.debate.DebateRepository") as MockRepo:
            mock_repo = AsyncMock()
            mock_repo.get_result = AsyncMock(return_value=mock_result)
            MockRepo.return_value = mock_repo

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.get("/api/debate/deb_running/result")

                assert response.status_code == 200
                data = response.json()
                assert data["data"]["status"] == "running"
                assert data["data"]["guardianVerdict"] is None
                assert data["data"]["totalVotes"] == 0


class TestCastVote:
    @pytest.mark.asyncio
    async def test_vote_success(self):
        vote_resp = VoteResponse(
            vote_id=str(uuid4()),
            debate_id="deb_test123",
            choice="bull",
            voter_fingerprint="fp_123",
        )

        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate(vote_resp=vote_resp)
            mock_rl.return_value.check = AsyncMock(return_value=_allowed_result())
            mock_cl.return_value.check = AsyncMock(return_value=_allowed_result(10000))

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
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

    @pytest.mark.asyncio
    async def test_vote_debate_not_found(self):
        with patch("app.routes.debate.DebateRepository") as MockRepo:
            mock_repo = AsyncMock()
            mock_repo.get_by_external_id = AsyncMock(return_value=None)
            MockRepo.return_value = mock_repo

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_nonexistent",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 404
                data = response.json()
                assert data["error"]["code"] == "DEBATE_NOT_FOUND"
                assert data["data"] is None

    @pytest.mark.asyncio
    async def test_vote_duplicate(self):
        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate(has_existing=True)
            mock_rl.return_value.check = AsyncMock(return_value=_allowed_result())
            mock_cl.return_value.check = AsyncMock(return_value=_allowed_result(10000))

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 409
                data = response.json()
                assert data["error"]["code"] == "DUPLICATE_VOTE"
                assert data["data"] is None

    @pytest.mark.asyncio
    async def test_vote_invalid_choice(self):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://localhost:8000"
        ) as client:
            response = await client.post(
                "/api/debate/vote",
                json={
                    "debate_id": "deb_test123",
                    "choice": "maybe",
                    "voter_fingerprint": "fp_123",
                },
            )
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_vote_empty_fingerprint(self):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://localhost:8000"
        ) as client:
            response = await client.post(
                "/api/debate/vote",
                json={
                    "debate_id": "deb_test123",
                    "choice": "bull",
                    "voter_fingerprint": "",
                },
            )
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_vote_camel_case_request(self):
        vote_resp = VoteResponse(
            vote_id=str(uuid4()),
            debate_id="deb_test123",
            choice="bear",
            voter_fingerprint="fp_456",
        )

        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate(vote_resp=vote_resp)
            mock_rl.return_value.check = AsyncMock(return_value=_allowed_result())
            mock_cl.return_value.check = AsyncMock(return_value=_allowed_result(10000))

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bear",
                        "voter_fingerprint": "fp_456",
                    },
                )
                assert response.status_code == 200
                data = response.json()
                assert "voteId" in data["data"]
                assert "debateId" in data["data"]
                assert "voterFingerprint" in data["data"]
                assert "createdAt" in data["data"]
                assert data["meta"]["isFinal"] is True

    @pytest.mark.asyncio
    async def test_vote_success_response_has_is_final(self):
        vote_resp = VoteResponse(
            vote_id=str(uuid4()),
            debate_id="deb_test123",
            choice="bull",
            voter_fingerprint="fp_123",
        )

        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate(vote_resp=vote_resp)
            mock_rl.return_value.check = AsyncMock(return_value=_allowed_result())
            mock_cl.return_value.check = AsyncMock(return_value=_allowed_result(10000))

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                data = response.json()
                assert data["meta"]["isFinal"] is True
                assert "latencyMs" in data["meta"]

    @pytest.mark.asyncio
    async def test_error_envelope_top_level(self):
        with patch("app.routes.debate.DebateRepository") as MockRepo:
            mock_repo = AsyncMock()
            mock_repo.get_by_external_id = AsyncMock(return_value=None)
            MockRepo.return_value = mock_repo

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_nonexistent",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                data = response.json()
                assert "data" in data
                assert "error" in data
                assert "meta" in data
                assert "detail" not in data


class TestRateLimitedVote:
    @pytest.mark.asyncio
    async def test_vote_succeeds_under_rate_limit(self):
        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate()
            mock_rl.return_value.check = AsyncMock(return_value=_allowed_result())
            mock_cl.return_value.check = AsyncMock(return_value=_allowed_result(10000))

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_vote_returns_429_when_rate_limited(self):
        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate()
            mock_cl.return_value.check = AsyncMock(return_value=_allowed_result(10000))
            mock_rl.return_value.check = AsyncMock(return_value=_blocked_result())

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 429
                data = response.json()
                assert data["error"]["code"] == "RATE_LIMITED"

    @pytest.mark.asyncio
    async def test_vote_429_at_exact_boundary(self):
        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate()
            mock_cl.return_value.check = AsyncMock(return_value=_allowed_result(10000))
            boundary_result = RateLimitResult(
                allowed=False,
                current=31,
                limit=30,
                remaining=0,
                reset_at=time.time() + 30,
            )
            mock_rl.return_value.check = AsyncMock(return_value=boundary_result)

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 429

    @pytest.mark.asyncio
    async def test_vote_succeeds_redis_connection_refused(self):
        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate()
            mock_rl.return_value.check = AsyncMock(return_value=_allowed_result())
            mock_cl.return_value.check = AsyncMock(return_value=_allowed_result(10000))

            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://localhost:8000",
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_vote_succeeds_redis_timeout(self):
        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate()
            mock_rl.return_value.check = AsyncMock(return_value=_allowed_result())
            mock_cl.return_value.check = AsyncMock(return_value=_allowed_result(10000))

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_vote_succeeds_capacity_redis_connection_refused(self):
        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate()
            mock_rl.return_value.check = AsyncMock(return_value=_allowed_result())
            mock_cl.return_value.check = AsyncMock(return_value=_allowed_result(10000))

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_vote_succeeds_capacity_redis_timeout(self):
        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate()
            mock_rl.return_value.check = AsyncMock(return_value=_allowed_result())
            mock_cl.return_value.check = AsyncMock(return_value=_allowed_result(10000))

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_retry_after_ms_accurate(self):
        reset_at = time.time() + 25.5
        blocked = RateLimitResult(
            allowed=False,
            current=31,
            limit=30,
            remaining=0,
            reset_at=reset_at,
        )

        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate()
            mock_cl.return_value.check = AsyncMock(return_value=_allowed_result(10000))
            mock_rl.return_value.check = AsyncMock(return_value=blocked)

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                data = response.json()
                assert "retryAfterMs" in data["meta"]
                assert abs(data["meta"]["retryAfterMs"] - 25500) < 500

    @pytest.mark.asyncio
    async def test_rate_limited_does_not_reach_capacity(self):
        capacity_check = AsyncMock(return_value=_allowed_result(10000))
        rate_check = AsyncMock(return_value=_blocked_result())

        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate()
            mock_cl.return_value.check = capacity_check
            mock_rl.return_value.check = rate_check

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 429
                capacity_check.assert_not_called()

    @pytest.mark.asyncio
    async def test_rate_limit_envelope_top_level(self):
        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate()
            mock_cl.return_value.check = AsyncMock(return_value=_allowed_result(10000))
            mock_rl.return_value.check = AsyncMock(return_value=_blocked_result())

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                data = response.json()
                assert "data" in data
                assert "error" in data
                assert "meta" in data
                assert "detail" not in data

    @pytest.mark.asyncio
    async def test_duplicate_takes_priority_over_rate_limit(self):
        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate(has_existing=True)
            mock_rl.return_value.check = AsyncMock(return_value=_blocked_result())
            mock_cl.return_value.check = AsyncMock(return_value=_allowed_result(10000))

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 409
                data = response.json()
                assert data["error"]["code"] == "DUPLICATE_VOTE"


class TestGracefulDegradation:
    @pytest.mark.asyncio
    async def test_vote_succeeds_under_capacity(self):
        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate()
            mock_rl.return_value.check = AsyncMock(return_value=_allowed_result())
            mock_cl.return_value.check = AsyncMock(return_value=_allowed_result(10000))

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_vote_503_when_capacity_exceeded(self):
        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate()
            mock_rl.return_value.check = AsyncMock(return_value=_allowed_result())
            mock_cl.return_value.check = AsyncMock(return_value=_blocked_result(10000))

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 503
                data = response.json()
                assert data["error"]["code"] == "VOTING_DISABLED"

    @pytest.mark.asyncio
    async def test_vote_503_at_exact_capacity_boundary(self):
        boundary = RateLimitResult(
            allowed=False,
            current=10001,
            limit=10000,
            remaining=0,
            reset_at=time.time() + 30,
        )

        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate()
            mock_rl.return_value.check = AsyncMock(return_value=_allowed_result())
            mock_cl.return_value.check = AsyncMock(return_value=boundary)

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 503

    @pytest.mark.asyncio
    async def test_rate_limited_does_not_reach_capacity(self):
        rate_check = AsyncMock(return_value=_blocked_result())
        capacity_check = AsyncMock(return_value=_allowed_result(10000))

        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate()
            mock_rl.return_value.check = rate_check
            mock_cl.return_value.check = capacity_check

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 429
                capacity_check.assert_not_called()


class TestVoterFingerprintValidation:
    @pytest.mark.asyncio
    async def test_empty_fingerprint_422(self):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://localhost:8000"
        ) as client:
            response = await client.post(
                "/api/debate/vote",
                json={
                    "debate_id": "deb_test123",
                    "choice": "bull",
                    "voter_fingerprint": "",
                },
            )
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_long_fingerprint_422(self):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://localhost:8000"
        ) as client:
            response = await client.post(
                "/api/debate/vote",
                json={
                    "debate_id": "deb_test123",
                    "choice": "bull",
                    "voter_fingerprint": "x" * 129,
                },
            )
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_null_fingerprint_422(self):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://localhost:8000"
        ) as client:
            response = await client.post(
                "/api/debate/vote",
                json={
                    "debate_id": "deb_test123",
                    "choice": "bull",
                },
            )
            assert response.status_code == 422


class TestDebateRunningStateGuard:
    @pytest.mark.asyncio
    async def test_vote_on_completed_debate_422(self):
        with patch("app.routes.debate.DebateRepository") as MockRepo:
            mock_repo = AsyncMock()
            mock_repo.get_by_external_id = AsyncMock(
                return_value=_make_debate(status="completed")
            )
            MockRepo.return_value = mock_repo

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 422
                data = response.json()
                assert data["error"]["code"] == "DEBATE_NOT_ACTIVE"
                assert data["meta"]["debateStatus"] == "completed"

    @pytest.mark.asyncio
    async def test_vote_on_paused_debate_422(self):
        with patch("app.routes.debate.DebateRepository") as MockRepo:
            mock_repo = AsyncMock()
            mock_repo.get_by_external_id = AsyncMock(
                return_value=_make_debate(status="paused")
            )
            MockRepo.return_value = mock_repo

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 422
                data = response.json()
                assert data["error"]["code"] == "DEBATE_NOT_ACTIVE"

    @pytest.mark.asyncio
    async def test_vote_on_cancelled_debate_422(self):
        with patch("app.routes.debate.DebateRepository") as MockRepo:
            mock_repo = AsyncMock()
            mock_repo.get_by_external_id = AsyncMock(
                return_value=_make_debate(status="cancelled")
            )
            MockRepo.return_value = mock_repo

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 422
                data = response.json()
                assert data["error"]["code"] == "DEBATE_NOT_ACTIVE"

    @pytest.mark.asyncio
    async def test_vote_on_running_debate_succeeds(self):
        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate()
            mock_rl.return_value.check = AsyncMock(return_value=_allowed_result())
            mock_cl.return_value.check = AsyncMock(return_value=_allowed_result(10000))

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 200


class TestGuardOrderingIntegration:
    @pytest.mark.asyncio
    async def test_full_guard_chain_success(self):
        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate()
            mock_rl.return_value.check = AsyncMock(return_value=_allowed_result())
            mock_cl.return_value.check = AsyncMock(return_value=_allowed_result(10000))

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 200
                data = response.json()
                assert data["data"]["choice"] == "bull"
                assert data["meta"]["isFinal"] is True

    @pytest.mark.asyncio
    async def test_db_write_failure_returns_503(self):
        mock_repo = _mock_repo_with_running_debate()
        mock_repo.create_vote = AsyncMock(side_effect=Exception("DB error"))
        mock_repo.has_existing_vote = AsyncMock(return_value=False)

        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = mock_repo
            mock_rl.return_value.check = AsyncMock(return_value=_allowed_result())
            mock_cl.return_value.check = AsyncMock(return_value=_allowed_result(10000))

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 503

    @pytest.mark.asyncio
    async def test_capacity_does_not_block_when_rate_rejects(self):
        rate_check = AsyncMock(return_value=_blocked_result())
        capacity_check = AsyncMock(return_value=_allowed_result(10000))

        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = _mock_repo_with_running_debate()
            mock_rl.return_value.check = rate_check
            mock_cl.return_value.check = capacity_check

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_test123",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 429
                capacity_check.assert_not_called()
