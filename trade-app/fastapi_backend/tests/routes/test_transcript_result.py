import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from app.services.debate.vote_schemas import DebateResultResponse, TranscriptMessage
from tests.routes.vote_test_helpers import make_client


class TestGetDebateResultTranscript:
    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_result_with_transcript(self):
        """[4.3-007] BDD: Given a debate with transcript, when GET /result?include_transcript=true, then response includes transcript array and repo called with include_transcript=True."""
        mock_result = DebateResultResponse(
            debate_id="deb_test123",
            asset="bitcoin",
            status="completed",
            current_turn=6,
            max_turns=6,
            created_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
            total_votes=5,
            vote_breakdown={"bull": 3, "bear": 2},
            transcript=[
                TranscriptMessage(role="bull", content="BTC rising"),
                TranscriptMessage(role="bear", content="BTC falling"),
            ],
        )

        with patch("app.routes.debate.DebateRepository") as MockRepo:
            mock_repo = AsyncMock()
            mock_repo.get_result = AsyncMock(return_value=mock_result)
            MockRepo.return_value = mock_repo

            async with await make_client() as client:
                response = await client.get(
                    "/api/debate/deb_test123/result?include_transcript=true"
                )

                assert response.status_code == 200
                data = response.json()
                assert data["data"]["transcript"] is not None
                assert len(data["data"]["transcript"]) == 2
                assert data["data"]["transcript"][0]["role"] == "bull"
                mock_repo.get_result.assert_called_once_with(
                    "deb_test123", include_transcript=True
                )

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_result_without_transcript_param(self):
        """[4.3-008] BDD: Given a debate result, when GET /result without include_transcript param, then transcript is None and repo called with include_transcript=False."""
        mock_result = DebateResultResponse(
            debate_id="deb_test123",
            asset="bitcoin",
            status="completed",
            current_turn=6,
            max_turns=6,
            created_at=datetime.now(timezone.utc),
            total_votes=5,
            vote_breakdown={"bull": 3, "bear": 2},
        )

        with patch("app.routes.debate.DebateRepository") as MockRepo:
            mock_repo = AsyncMock()
            mock_repo.get_result = AsyncMock(return_value=mock_result)
            MockRepo.return_value = mock_repo

            async with await make_client() as client:
                response = await client.get("/api/debate/deb_test123/result")

                assert response.status_code == 200
                data = response.json()
                assert data["data"]["transcript"] is None
                mock_repo.get_result.assert_called_once_with(
                    "deb_test123", include_transcript=False
                )
