import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient, ASGITransport
from datetime import datetime, timezone
from uuid import uuid4

from app.main import app
from app.services.debate.vote_schemas import VoteResponse


def _make_debate(
    external_id: str = "deb_test123", asset: str = "bitcoin", **kwargs
) -> MagicMock:
    d = MagicMock()
    d.id = uuid4()
    d.external_id = external_id
    d.asset = asset
    d.status = kwargs.get("status", "completed")
    d.current_turn = kwargs.get("current_turn", 6)
    d.max_turns = kwargs.get("max_turns", 6)
    d.guardian_verdict = kwargs.get("guardian_verdict", "Caution")
    d.guardian_interrupts_count = kwargs.get("guardian_interrupts_count", 2)
    d.transcript = kwargs.get("transcript", None)
    d.created_at = kwargs.get("created_at", datetime.now(timezone.utc))
    d.completed_at = kwargs.get("completed_at", datetime.now(timezone.utc))
    return d


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
                assert data["detail"]["error"]["code"] == "DEBATE_NOT_FOUND"

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

        with patch("app.routes.debate.DebateRepository") as MockRepo:
            mock_repo = AsyncMock()
            mock_repo.get_by_external_id = AsyncMock(return_value=_make_debate())
            mock_repo.cast_vote = AsyncMock(return_value=vote_resp)
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
                assert response.status_code == 200
                data = response.json()
                assert data["data"]["choice"] == "bull"
                assert data["data"]["debateId"] == "deb_test123"
                assert data["error"] is None

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
                assert data["detail"]["error"]["code"] == "DEBATE_NOT_FOUND"

    @pytest.mark.asyncio
    async def test_vote_duplicate(self):
        with patch("app.routes.debate.DebateRepository") as MockRepo:
            mock_repo = AsyncMock()
            mock_repo.get_by_external_id = AsyncMock(return_value=_make_debate())
            mock_repo.cast_vote = AsyncMock(return_value=None)
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
                assert response.status_code == 409
                data = response.json()
                assert data["detail"]["error"]["code"] == "DUPLICATE_VOTE"

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

        with patch("app.routes.debate.DebateRepository") as MockRepo:
            mock_repo = AsyncMock()
            mock_repo.get_by_external_id = AsyncMock(return_value=_make_debate())
            mock_repo.cast_vote = AsyncMock(return_value=vote_resp)
            MockRepo.return_value = mock_repo

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
