import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from tests.routes.vote_test_helpers import make_client


class TestGetDebateResult:
    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_result_found(self):
        """[3-1-API-001] Given completed debate with votes, When GET /result, Then 200 with full result"""
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

            async with await make_client() as client:
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

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_result_not_found(self):
        """[3-1-API-002] Given nonexistent debate, When GET /result, Then 404 DEBATE_NOT_FOUND"""
        with patch("app.routes.debate.DebateRepository") as MockRepo:
            mock_repo = AsyncMock()
            mock_repo.get_result = AsyncMock(return_value=None)
            MockRepo.return_value = mock_repo

            async with await make_client() as client:
                response = await client.get("/api/debate/deb_nonexistent/result")

                assert response.status_code == 404
                data = response.json()
                assert data["error"]["code"] == "DEBATE_NOT_FOUND"

    @pytest.mark.p2
    @pytest.mark.asyncio
    async def test_result_running_debate(self):
        """[3-1-API-003] Given running debate with no votes, When GET /result, Then 200 with empty breakdown"""
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

            async with await make_client() as client:
                response = await client.get("/api/debate/deb_running/result")

                assert response.status_code == 200
                data = response.json()
                assert data["data"]["status"] == "running"
                assert data["data"]["guardianVerdict"] is None
                assert data["data"]["totalVotes"] == 0
