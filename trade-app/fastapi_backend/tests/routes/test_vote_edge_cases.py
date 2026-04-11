import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.routes.debate import _hash_fingerprint


class TestFingerprintHashing:
    @pytest.mark.p2
    def test_hash_deterministic(self):
        """[3-1-EDGE-001] Given same fingerprint input, When hashed twice, Then hashes are equal"""
        h1 = _hash_fingerprint("fp_123")
        h2 = _hash_fingerprint("fp_123")
        assert h1 == h2

    @pytest.mark.p2
    def test_hash_different_inputs(self):
        """[3-1-EDGE-002] Given different fingerprint inputs, When hashed, Then hashes differ"""
        h1 = _hash_fingerprint("fp_123")
        h2 = _hash_fingerprint("fp_456")
        assert h1 != h2

    @pytest.mark.p2
    def test_hash_length(self):
        """[3-1-EDGE-003] Given any fingerprint, When hashed, Then output is 16 chars"""
        h = _hash_fingerprint("fp_abc")
        assert len(h) == 16

    @pytest.mark.p2
    def test_hash_unicode_input(self):
        """[3-1-EDGE-004] Given unicode fingerprint, When hashed, Then output is 16 chars"""
        h = _hash_fingerprint("fp_emoji_🔥")
        assert len(h) == 16

    @pytest.mark.p2
    def test_hash_empty_string(self):
        """[3-1-EDGE-005] Given empty string, When hashed, Then output is 16 chars"""
        h = _hash_fingerprint("")
        assert len(h) == 16


class TestVoteRequestMissingFields:
    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_missing_debate_id(self):
        """[3-1-EDGE-006] Given request without debate_id, When POST /vote, Then 422"""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://localhost:8000"
        ) as client:
            response = await client.post(
                "/api/debate/vote",
                json={"choice": "bull", "voter_fingerprint": "fp_123"},
            )
            assert response.status_code == 422

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_missing_choice(self):
        """[3-1-EDGE-007] Given request without choice, When POST /vote, Then 422"""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://localhost:8000"
        ) as client:
            response = await client.post(
                "/api/debate/vote",
                json={"debate_id": "deb_test", "voter_fingerprint": "fp_123"},
            )
            assert response.status_code == 422

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_missing_voter_fingerprint(self):
        """[3-1-EDGE-008] Given request without voter_fingerprint, When POST /vote, Then 422"""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://localhost:8000"
        ) as client:
            response = await client.post(
                "/api/debate/vote",
                json={"debate_id": "deb_test", "choice": "bull"},
            )
            assert response.status_code == 422

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_empty_body(self):
        """[3-1-EDGE-009] Given empty JSON body, When POST /vote, Then 422"""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://localhost:8000"
        ) as client:
            response = await client.post(
                "/api/debate/vote",
                json={},
            )
            assert response.status_code == 422


class TestVoteChoiceNormalization:
    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_uppercase_choice_accepted(self):
        """[3-1-EDGE-010] Given uppercase BULL choice, When POST /vote, Then 200 with normalized 'bull'"""
        from unittest.mock import MagicMock
        import time
        from uuid import uuid4

        from app.services.debate.vote_schemas import VoteResponse
        from app.services.rate_limiter import RateLimitResult

        vote_resp = VoteResponse(
            vote_id=str(uuid4()),
            debate_id="deb_norm",
            choice="bull",
            voter_fingerprint="fp_norm",
        )

        mock_repo = AsyncMock()
        mock_repo.get_by_external_id = AsyncMock()
        mock_repo.get_by_external_id.return_value = MagicMock(
            id=uuid4(), status="running"
        )
        mock_repo.has_existing_vote = AsyncMock(return_value=False)
        mock_repo.create_vote = AsyncMock(return_value=vote_resp)

        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = mock_repo
            mock_rl.return_value.check = AsyncMock(
                return_value=RateLimitResult(
                    allowed=True,
                    current=1,
                    limit=10,
                    remaining=9,
                    reset_at=time.time() + 60,
                )
            )
            mock_cl.return_value.check = AsyncMock(
                return_value=RateLimitResult(
                    allowed=True,
                    current=1,
                    limit=10000,
                    remaining=9999,
                    reset_at=time.time() + 60,
                )
            )

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_norm",
                        "choice": "BULL",
                        "voter_fingerprint": "fp_norm",
                    },
                )
                assert response.status_code == 200
                assert response.json()["data"]["choice"] == "bull"

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_mixed_case_with_whitespace(self):
        """[3-1-EDGE-011] Given '  Bear  ' choice, When POST /vote, Then 200 with normalized 'bear'"""
        from unittest.mock import MagicMock
        import time
        from uuid import uuid4

        from app.services.debate.vote_schemas import VoteResponse
        from app.services.rate_limiter import RateLimitResult

        vote_resp = VoteResponse(
            vote_id=str(uuid4()),
            debate_id="deb_norm2",
            choice="bear",
            voter_fingerprint="fp_norm2",
        )

        mock_repo = AsyncMock()
        mock_repo.get_by_external_id = AsyncMock()
        mock_repo.get_by_external_id.return_value = MagicMock(
            id=uuid4(), status="running"
        )
        mock_repo.has_existing_vote = AsyncMock(return_value=False)
        mock_repo.create_vote = AsyncMock(return_value=vote_resp)

        with (
            patch("app.routes.debate.DebateRepository") as MockRepo,
            patch("app.routes.debate._get_vote_limiter") as mock_rl,
            patch("app.routes.debate._get_capacity_limiter") as mock_cl,
        ):
            MockRepo.return_value = mock_repo
            mock_rl.return_value.check = AsyncMock(
                return_value=RateLimitResult(
                    allowed=True,
                    current=1,
                    limit=10,
                    remaining=9,
                    reset_at=time.time() + 60,
                )
            )
            mock_cl.return_value.check = AsyncMock(
                return_value=RateLimitResult(
                    allowed=True,
                    current=1,
                    limit=10000,
                    remaining=9999,
                    reset_at=time.time() + 60,
                )
            )

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://localhost:8000"
            ) as client:
                response = await client.post(
                    "/api/debate/vote",
                    json={
                        "debate_id": "deb_norm2",
                        "choice": "  Bear  ",
                        "voter_fingerprint": "fp_norm2",
                    },
                )
                assert response.status_code == 200
                assert response.json()["data"]["choice"] == "bear"
