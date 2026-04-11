import pytest
from unittest.mock import AsyncMock, patch

from tests.routes.vote_test_helpers import (
    make_client,
    post_vote,
    mock_vote_deps,
    make_vote_response,
)


class TestCastVote:
    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_vote_success_with_allowed_rate_limiter(self):
        """[3-1-API-004] Given valid vote and allowed rate limiter, When POST /vote, Then 200"""
        with mock_vote_deps():
            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 200

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_vote_success_with_allowed_capacity_limiter(self):
        """[3-1-API-005] Given valid vote and allowed capacity limiter, When POST /vote, Then 200"""
        with mock_vote_deps():
            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 200

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_vote_debate_not_found(self):
        """[3-1-API-006] Given nonexistent debate, When POST /vote, Then 404 DEBATE_NOT_FOUND"""
        with patch("app.routes.debate.DebateRepository") as MockRepo:
            mock_repo = AsyncMock()
            mock_repo.get_by_external_id = AsyncMock(return_value=None)
            MockRepo.return_value = mock_repo

            async with await make_client() as client:
                response = await post_vote(
                    client,
                    {
                        "debate_id": "deb_nonexistent",
                        "choice": "bull",
                        "voter_fingerprint": "fp_123",
                    },
                )
                assert response.status_code == 404
                data = response.json()
                assert data["error"]["code"] == "DEBATE_NOT_FOUND"
                assert data["data"] is None

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_vote_duplicate(self):
        """[3-1-API-007] Given existing vote from same fingerprint, When POST /vote, Then 409 DUPLICATE_VOTE"""
        with mock_vote_deps(has_existing=True):
            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 409
                data = response.json()
                assert data["error"]["code"] == "DUPLICATE_VOTE"
                assert data["data"] is None

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_vote_invalid_choice(self):
        """[3-1-API-008] Given invalid choice, When POST /vote, Then 422"""
        async with await make_client() as client:
            response = await post_vote(
                client,
                {
                    "debate_id": "deb_test123",
                    "choice": "maybe",
                    "voter_fingerprint": "fp_123",
                },
            )
            assert response.status_code == 422

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_vote_empty_fingerprint(self):
        """[3-1-API-009] Given empty fingerprint, When POST /vote, Then 422"""
        async with await make_client() as client:
            response = await post_vote(
                client,
                {"debate_id": "deb_test123", "choice": "bull", "voter_fingerprint": ""},
            )
            assert response.status_code == 422

    @pytest.mark.p2
    @pytest.mark.asyncio
    async def test_vote_camel_case_response(self):
        """[3-1-API-010] Given successful vote, When response serialized, Then camelCase keys in data"""
        vote_resp = make_vote_response(choice="bear", fingerprint="fp_456")
        with mock_vote_deps(vote_resp=vote_resp):
            async with await make_client() as client:
                response = await post_vote(
                    client,
                    {
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

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_vote_success_meta_is_final(self):
        """[3-1-API-011] Given successful vote, When response returned, Then meta.isFinal is true"""
        vote_resp = make_vote_response()
        with mock_vote_deps(vote_resp=vote_resp):
            async with await make_client() as client:
                response = await post_vote(client)
                data = response.json()
                assert data["meta"]["isFinal"] is True
                assert "latencyMs" in data["meta"]

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_error_envelope_top_level(self):
        """[3-1-API-012] Given vote error, When response returned, Then envelope at top level not nested in detail"""
        with patch("app.routes.debate.DebateRepository") as MockRepo:
            mock_repo = AsyncMock()
            mock_repo.get_by_external_id = AsyncMock(return_value=None)
            MockRepo.return_value = mock_repo

            async with await make_client() as client:
                response = await post_vote(
                    client,
                    {
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

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_duplicate_takes_priority_over_rate_limit(self):
        """[3-1-API-013] Given duplicate vote AND rate-limited, When POST /vote, Then 409 (duplicate first per guard ordering)"""
        from tests.routes.vote_test_helpers import blocked_result

        with mock_vote_deps(has_existing=True, rate_result=blocked_result()):
            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 409
                data = response.json()
                assert data["error"]["code"] == "DUPLICATE_VOTE"
