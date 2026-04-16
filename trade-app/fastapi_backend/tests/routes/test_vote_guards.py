import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from tests.routes.vote_test_helpers import (
    make_client,
    post_vote,
    mock_vote_deps,
    allowed_result,
    blocked_result,
    make_debate,
    mock_repo_with_running_debate,
)


class TestVoterFingerprintValidation:
    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_empty_fingerprint_422(self):
        """[3-1-API-027] Given empty fingerprint, When POST /vote, Then 422"""
        async with await make_client() as client:
            response = await post_vote(
                client,
                {"debate_id": "deb_test123", "choice": "bull", "voter_fingerprint": ""},
            )
            assert response.status_code == 422

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_long_fingerprint_422(self):
        """[3-1-API-028] Given 129-char fingerprint, When POST /vote, Then 422"""
        async with await make_client() as client:
            response = await post_vote(
                client,
                {
                    "debate_id": "deb_test123",
                    "choice": "bull",
                    "voter_fingerprint": "x" * 129,
                },
            )
            assert response.status_code == 422

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_null_fingerprint_422(self):
        """[3-1-API-029] Given missing fingerprint field, When POST /vote, Then 422"""
        async with await make_client() as client:
            response = await post_vote(
                client, {"debate_id": "deb_test123", "choice": "bull"}
            )
            assert response.status_code == 422


class TestDebateRunningStateGuard:
    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_vote_on_completed_debate_422(self):
        """[3-1-API-030] Given completed debate, When POST /vote, Then 422 DEBATE_NOT_ACTIVE"""
        with patch("app.routes.debate.DebateRepository") as MockRepo:
            mock_repo = AsyncMock()
            mock_repo.get_by_external_id = AsyncMock(
                return_value=make_debate(status="completed")
            )
            MockRepo.return_value = mock_repo

            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 422
                data = response.json()
                assert data["error"]["code"] == "DEBATE_NOT_ACTIVE"
                assert data["meta"]["debateStatus"] == "completed"

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_vote_on_paused_debate_422(self):
        """[3-1-API-031] Given paused debate, When POST /vote, Then 422 DEBATE_NOT_ACTIVE"""
        with patch("app.routes.debate.DebateRepository") as MockRepo:
            mock_repo = AsyncMock()
            mock_repo.get_by_external_id = AsyncMock(
                return_value=make_debate(status="paused")
            )
            MockRepo.return_value = mock_repo

            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 422
                data = response.json()
                assert data["error"]["code"] == "DEBATE_NOT_ACTIVE"

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_vote_on_cancelled_debate_422(self):
        """[3-1-API-032] Given cancelled debate, When POST /vote, Then 422 DEBATE_NOT_ACTIVE"""
        with patch("app.routes.debate.DebateRepository") as MockRepo:
            mock_repo = AsyncMock()
            mock_repo.get_by_external_id = AsyncMock(
                return_value=make_debate(status="cancelled")
            )
            MockRepo.return_value = mock_repo

            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 422
                data = response.json()
                assert data["error"]["code"] == "DEBATE_NOT_ACTIVE"

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_vote_on_running_debate_succeeds(self):
        """[3-1-API-033] Given running debate, When POST /vote, Then 200"""
        with mock_vote_deps():
            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 200


class TestGuardOrderingIntegration:
    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_full_guard_chain_success(self):
        """[3-1-API-034] Given valid request, When all 6 guards pass, Then 200 with correct data and isFinal"""
        with mock_vote_deps():
            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 200
                data = response.json()
                assert data["data"]["choice"] == "bull"
                assert data["meta"]["isFinal"] is True

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_db_write_failure_returns_503(self):
        """[3-1-API-035] Given DB write error, When POST /vote, Then 503"""
        mock_repo = mock_repo_with_running_debate()
        mock_repo.create_vote = AsyncMock(side_effect=Exception("DB error"))
        mock_repo.has_existing_vote = AsyncMock(return_value=False)

        with mock_vote_deps(repo_override=mock_repo):
            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 503

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_capacity_does_not_block_when_rate_rejects(self):
        """[3-1-API-036] Given rate-limited request, When POST /vote, Then capacity limiter never invoked"""
        from unittest.mock import patch

        rate_check = AsyncMock(return_value=blocked_result())
        capacity_check = AsyncMock(return_value=allowed_result(10000))

        with patch("app.routes.debate.DebateRepository") as MockRepo:
            MockRepo.return_value = mock_repo_with_running_debate()
            with (
                patch("app.routes.debate._get_vote_limiter") as mock_rl,
                patch("app.routes.debate._get_capacity_limiter") as mock_cl,
            ):
                mock_rl.return_value.check = rate_check
                limiter = MagicMock()
                limiter.check = capacity_check
                mock_cl.return_value = limiter

                async with await make_client() as client:
                    response = await post_vote(client)
                    assert response.status_code == 429
                    capacity_check.assert_not_called()

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_capacity_decremented_on_db_write_failure(self):
        """[3-1-API-037] Given DB write failure after capacity check, When POST /vote, Then capacity limiter release() called (no leak)"""
        mock_repo = mock_repo_with_running_debate()
        mock_repo.create_vote = AsyncMock(side_effect=Exception("DB error"))
        mock_repo.has_existing_vote = AsyncMock(return_value=False)

        capacity_limiter = MagicMock()
        capacity_limiter.check = AsyncMock(return_value=allowed_result(10000))
        capacity_limiter.release = AsyncMock()

        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = mock_repo
            mock_rl.return_value.check = AsyncMock(return_value=allowed_result())
            mock_cl.return_value = capacity_limiter

            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 503
                capacity_limiter.release.assert_called_once_with("global", None)

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_capacity_decremented_on_integrity_error(self):
        """[3-1-API-038] Given IntegrityError (TOCTOU duplicate) after capacity check, When POST /vote, Then capacity limiter release() called"""
        from sqlalchemy.exc import IntegrityError

        mock_repo = mock_repo_with_running_debate()
        mock_repo.create_vote = AsyncMock(
            side_effect=IntegrityError("", "", Exception("unique constraint"))
        )
        mock_repo.has_existing_vote = AsyncMock(return_value=False)

        capacity_limiter = MagicMock()
        capacity_limiter.check = AsyncMock(return_value=allowed_result(10000))
        capacity_limiter.release = AsyncMock()

        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = mock_repo
            mock_rl.return_value.check = AsyncMock(return_value=allowed_result())
            mock_cl.return_value = capacity_limiter

            async with await make_client() as client:
                response = await post_vote(client)
                assert response.status_code == 409
                assert response.json()["error"]["code"] == "DUPLICATE_VOTE"
                capacity_limiter.release.assert_called_once_with("global", None)
