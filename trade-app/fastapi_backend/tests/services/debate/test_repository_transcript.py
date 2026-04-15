import json
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.debate.repository import DebateRepository


def _make_debate_row(
    external_id: str = "deb_test123",
    transcript: str | None = None,
):
    d = MagicMock()
    d.id = MagicMock()
    d.external_id = external_id
    d.asset = "btc"
    d.status = "completed"
    d.current_turn = 6
    d.max_turns = 6
    d.guardian_verdict = None
    d.guardian_interrupts_count = 0
    d.transcript = transcript
    d.created_at = datetime.now(timezone.utc)
    d.completed_at = datetime.now(timezone.utc)
    return d


@pytest.fixture
def mock_session():
    session = AsyncMock()
    return session


class TestGetResultTranscriptDeserialization:
    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_include_transcript_true_with_valid_json(self, mock_session):
        transcript_json = json.dumps(
            [
                {"role": "bull", "content": "BTC rising"},
                {"role": "bear", "content": "BTC falling"},
            ]
        )
        debate = _make_debate_row(transcript=transcript_json)

        mock_session.execute = AsyncMock(
            side_effect=[
                AsyncMock(scalar_one_or_none=MagicMock(return_value=debate)),
                AsyncMock(fetchall=MagicMock(return_value=[])),
            ]
        )

        repo = DebateRepository(mock_session)
        with patch.object(repo, "get_by_external_id", return_value=debate):
            result = await repo.get_result("deb_test123", include_transcript=True)

        assert result is not None
        assert result.transcript is not None
        assert len(result.transcript) == 2
        assert result.transcript[0].role == "bull"
        assert result.transcript[0].content == "BTC rising"

    @pytest.mark.p0
    @pytest.mark.asyncio
    async def test_include_transcript_false_returns_none(self, mock_session):
        transcript_json = json.dumps(
            [
                {"role": "bull", "content": "BTC rising"},
            ]
        )
        debate = _make_debate_row(transcript=transcript_json)

        repo = DebateRepository(mock_session)
        with patch.object(repo, "get_by_external_id", return_value=debate):
            result = await repo.get_result("deb_test123", include_transcript=False)

        assert result is not None
        assert result.transcript is None

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_include_transcript_true_with_null_column(self, mock_session):
        debate = _make_debate_row(transcript=None)

        repo = DebateRepository(mock_session)
        with patch.object(repo, "get_by_external_id", return_value=debate):
            result = await repo.get_result("deb_test123", include_transcript=True)

        assert result is not None
        assert result.transcript is None

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_include_transcript_true_with_empty_list(self, mock_session):
        debate = _make_debate_row(transcript="[]")

        repo = DebateRepository(mock_session)
        with patch.object(repo, "get_by_external_id", return_value=debate):
            result = await repo.get_result("deb_test123", include_transcript=True)

        assert result is not None
        assert result.transcript == []

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_corrupt_json_returns_none(self, mock_session):
        debate = _make_debate_row(transcript="not valid json{")

        repo = DebateRepository(mock_session)
        with patch.object(repo, "get_by_external_id", return_value=debate):
            result = await repo.get_result("deb_test123", include_transcript=True)

        assert result is not None
        assert result.transcript is None

    @pytest.mark.p1
    @pytest.mark.asyncio
    async def test_missing_content_key_returns_none(self, mock_session):
        debate = _make_debate_row(transcript=json.dumps([{"role": "bull"}]))

        repo = DebateRepository(mock_session)
        with patch.object(repo, "get_by_external_id", return_value=debate):
            result = await repo.get_result("deb_test123", include_transcript=True)

        assert result is not None
        assert result.transcript is None

    @pytest.mark.p2
    @pytest.mark.asyncio
    async def test_debate_not_found_returns_none(self, mock_session):
        repo = DebateRepository(mock_session)
        with patch.object(repo, "get_by_external_id", return_value=None):
            result = await repo.get_result("nonexistent", include_transcript=True)

        assert result is None

    @pytest.mark.p2
    @pytest.mark.asyncio
    async def test_transcript_non_list_json_returns_none(self, mock_session):
        debate = _make_debate_row(
            transcript=json.dumps({"role": "bull", "content": "oops"})
        )

        repo = DebateRepository(mock_session)
        with patch.object(repo, "get_by_external_id", return_value=debate):
            result = await repo.get_result("deb_test123", include_transcript=True)

        assert result is not None
        assert result.transcript is None

    @pytest.mark.p2
    @pytest.mark.asyncio
    async def test_include_transcript_default_is_false(self, mock_session):
        debate = _make_debate_row(
            transcript=json.dumps([{"role": "bull", "content": "hidden"}])
        )

        repo = DebateRepository(mock_session)
        with patch.object(repo, "get_by_external_id", return_value=debate):
            result = await repo.get_result("deb_test123")

        assert result is not None
        assert result.transcript is None
