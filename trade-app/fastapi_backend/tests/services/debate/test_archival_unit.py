import json
from unittest.mock import AsyncMock

import pytest

from tests.services.debate.conftest import SAMPLE_ARCHIVAL_STATE, mock_execute_result


class TestArchivalUnit:
    """[4-1-UNIT] Unit tests for archival service (mocked DB/Redis)."""

    @pytest.mark.asyncio
    async def test_archive_persists_transcript_and_verdict(
        self, archival_mocks, mock_archival_repo, debate_not_archived
    ):
        mock_archival_repo.get_by_external_id_for_update.return_value = (
            debate_not_archived
        )
        archival_mocks["session"].execute.return_value = mock_execute_result(
            [("bull", 5), ("bear", 3), ("undecided", 2)]
        )
        from app.services.debate.archival import archive_debate

        await archive_debate("deb_test123", SAMPLE_ARCHIVAL_STATE)

        mock_archival_repo.complete_debate.assert_called_once()
        call_kwargs = mock_archival_repo.complete_debate.call_args[1]
        assert call_kwargs["external_id"] == "deb_test123"
        assert call_kwargs["guardian_verdict"] == "Caution"
        assert call_kwargs["current_turn"] == 2
        assert call_kwargs["vote_bull"] == 5
        assert call_kwargs["vote_bear"] == 3
        assert call_kwargs["vote_undecided"] == 2
        transcript = json.loads(call_kwargs["transcript"])
        assert len(transcript) == 2
        assert transcript[0]["role"] == "bull"

    @pytest.mark.asyncio
    async def test_archive_stores_vote_counts(
        self, archival_mocks, mock_archival_repo, debate_not_archived
    ):
        mock_archival_repo.get_by_external_id_for_update.return_value = (
            debate_not_archived
        )
        archival_mocks["session"].execute.return_value = mock_execute_result(
            [("bull", 10), ("bear", 7), ("undecided", 3)]
        )
        from app.services.debate.archival import archive_debate

        await archive_debate("deb_test123", SAMPLE_ARCHIVAL_STATE)

        call_kwargs = mock_archival_repo.complete_debate.call_args[1]
        assert call_kwargs["vote_bull"] == 10
        assert call_kwargs["vote_bear"] == 7
        assert call_kwargs["vote_undecided"] == 3

    @pytest.mark.asyncio
    async def test_archive_deletes_redis_state_on_success(
        self, archival_mocks, mock_archival_repo, debate_not_archived
    ):
        mock_archival_repo.get_by_external_id_for_update.return_value = (
            debate_not_archived
        )
        archival_mocks["session"].execute.return_value = mock_execute_result([])
        from app.services.debate.archival import archive_debate

        await archive_debate("deb_test123", SAMPLE_ARCHIVAL_STATE)

        archival_mocks["stream_state"].delete_state.assert_called_once_with(
            "deb_test123"
        )

    @pytest.mark.asyncio
    async def test_archive_preserves_redis_on_db_failure(
        self, archival_mocks, mock_archival_repo, debate_not_archived
    ):
        mock_archival_repo.get_by_external_id_for_update.return_value = (
            debate_not_archived
        )
        mock_archival_repo.complete_debate.side_effect = Exception("DB error")
        archival_mocks["session"].execute.return_value = mock_execute_result([])
        from app.services.debate.archival import archive_debate

        with pytest.raises(Exception, match="DB error"):
            await archive_debate("deb_test123", SAMPLE_ARCHIVAL_STATE)

        archival_mocks["stream_state"].delete_state.assert_not_called()

    @pytest.mark.asyncio
    async def test_archive_db_success_redis_delete_failure(
        self, archival_mocks, mock_archival_repo, debate_not_archived
    ):
        mock_archival_repo.get_by_external_id_for_update.return_value = (
            debate_not_archived
        )
        archival_mocks["session"].execute.return_value = mock_execute_result([])
        archival_mocks["stream_state"].delete_state = AsyncMock(
            side_effect=Exception("Redis error")
        )
        from app.services.debate.archival import archive_debate

        await archive_debate("deb_test123", SAMPLE_ARCHIVAL_STATE)

        mock_archival_repo.complete_debate.assert_called_once()

    @pytest.mark.asyncio
    async def test_archive_is_idempotent_already_archived(
        self, archival_mocks, mock_archival_repo, debate_already_archived
    ):
        mock_archival_repo.get_by_external_id_for_update.return_value = (
            debate_already_archived
        )
        from app.services.debate.archival import archive_debate

        await archive_debate("deb_test123", SAMPLE_ARCHIVAL_STATE)

        mock_archival_repo.complete_debate.assert_not_called()

    @pytest.mark.asyncio
    async def test_archive_is_idempotent_no_state_provided_no_redis(self):
        from unittest.mock import patch, AsyncMock

        with patch("app.services.debate.archival.stream_state") as mock_ss:
            mock_ss.get_state = AsyncMock(return_value=None)
            from app.services.debate.archival import archive_debate

            await archive_debate("deb_test123", state=None)

    @pytest.mark.asyncio
    async def test_archive_handles_partial_state_missing_messages(
        self, archival_mocks, mock_archival_repo, debate_not_archived
    ):
        partial_state = {
            "debate_id": "deb_test123",
            "asset": "bitcoin",
            "status": "completed",
            "current_turn": 1,
        }
        mock_archival_repo.get_by_external_id_for_update.return_value = (
            debate_not_archived
        )
        archival_mocks["session"].execute.return_value = mock_execute_result([])
        from app.services.debate.archival import archive_debate

        await archive_debate("deb_test123", partial_state)

        call_kwargs = mock_archival_repo.complete_debate.call_args[1]
        transcript = json.loads(call_kwargs["transcript"])
        assert transcript == []

    @pytest.mark.asyncio
    async def test_archive_with_no_guardian_verdict(
        self, archival_mocks, mock_archival_repo, debate_not_archived
    ):
        state_no_verdict = {**SAMPLE_ARCHIVAL_STATE}
        del state_no_verdict["guardian_verdict"]
        mock_archival_repo.get_by_external_id_for_update.return_value = (
            debate_not_archived
        )
        archival_mocks["session"].execute.return_value = mock_execute_result([])
        from app.services.debate.archival import archive_debate

        await archive_debate("deb_test123", state_no_verdict)

        call_kwargs = mock_archival_repo.complete_debate.call_args[1]
        assert call_kwargs["guardian_verdict"] is None

    @pytest.mark.asyncio
    async def test_archive_with_zero_votes(
        self, archival_mocks, mock_archival_repo, debate_not_archived
    ):
        mock_archival_repo.get_by_external_id_for_update.return_value = (
            debate_not_archived
        )
        archival_mocks["session"].execute.return_value = mock_execute_result([])
        from app.services.debate.archival import archive_debate

        await archive_debate("deb_test123", SAMPLE_ARCHIVAL_STATE)

        call_kwargs = mock_archival_repo.complete_debate.call_args[1]
        assert call_kwargs["vote_bull"] == 0
        assert call_kwargs["vote_bear"] == 0
        assert call_kwargs["vote_undecided"] == 0


class TestArchivalExtendedUnit:
    """[4-1-UNIT] Extended coverage: edge cases, review findings, error paths."""

    @pytest.mark.asyncio
    async def test_archive_debate_not_found_in_db(
        self, archival_mocks, mock_archival_repo
    ):
        mock_archival_repo.get_by_external_id_for_update.return_value = None
        from app.services.debate.archival import archive_debate

        await archive_debate("deb_nonexistent", SAMPLE_ARCHIVAL_STATE)

        mock_archival_repo.complete_debate.assert_not_called()

    @pytest.mark.asyncio
    async def test_archive_non_list_guardian_interrupts(
        self, archival_mocks, mock_archival_repo, debate_not_archived
    ):
        state_bad_interrupts = {
            **SAMPLE_ARCHIVAL_STATE,
            "guardian_interrupts": "corrupted_string",
        }
        mock_archival_repo.get_by_external_id_for_update.return_value = (
            debate_not_archived
        )
        archival_mocks["session"].execute.return_value = mock_execute_result([])
        from app.services.debate.archival import archive_debate

        await archive_debate("deb_test123", state_bad_interrupts)

        call_kwargs = mock_archival_repo.complete_debate.call_args[1]
        assert call_kwargs["guardian_interrupts_count"] == 0

    @pytest.mark.asyncio
    async def test_archive_empty_messages_list(
        self, archival_mocks, mock_archival_repo, debate_not_archived
    ):
        state_empty = {**SAMPLE_ARCHIVAL_STATE, "messages": []}
        mock_archival_repo.get_by_external_id_for_update.return_value = (
            debate_not_archived
        )
        archival_mocks["session"].execute.return_value = mock_execute_result([])
        from app.services.debate.archival import archive_debate

        await archive_debate("deb_test123", state_empty)

        call_kwargs = mock_archival_repo.complete_debate.call_args[1]
        assert json.loads(call_kwargs["transcript"]) == []

    @pytest.mark.asyncio
    async def test_archive_unexpected_vote_choices_ignored(
        self, archival_mocks, mock_archival_repo, debate_not_archived
    ):
        mock_archival_repo.get_by_external_id_for_update.return_value = (
            debate_not_archived
        )
        archival_mocks["session"].execute.return_value = mock_execute_result(
            [("bull", 5), ("invalid_choice", 3)]
        )
        from app.services.debate.archival import archive_debate

        await archive_debate("deb_test123", SAMPLE_ARCHIVAL_STATE)

        call_kwargs = mock_archival_repo.complete_debate.call_args[1]
        assert call_kwargs["vote_bull"] == 5
        assert call_kwargs["vote_bear"] == 0
        assert call_kwargs["vote_undecided"] == 0

    @pytest.mark.asyncio
    async def test_archive_redis_fallback_path(
        self, archival_mocks, mock_archival_repo, debate_not_archived
    ):
        redis_state = {
            "messages": [{"role": "bull", "content": "From Redis"}],
            "guardian_verdict": "Low Risk",
            "guardian_interrupts": [],
            "current_turn": 3,
        }
        mock_archival_repo.get_by_external_id_for_update.return_value = (
            debate_not_archived
        )
        archival_mocks["session"].execute.return_value = mock_execute_result([])
        archival_mocks["stream_state"].get_state = AsyncMock(return_value=redis_state)
        from app.services.debate.archival import archive_debate

        await archive_debate("deb_test123", state=None)

        mock_archival_repo.complete_debate.assert_called_once()
        call_kwargs = mock_archival_repo.complete_debate.call_args[1]
        assert call_kwargs["current_turn"] == 3

    @pytest.mark.asyncio
    async def test_archive_large_transcript(
        self, archival_mocks, mock_archival_repo, debate_not_archived
    ):
        large_messages = [
            {"role": "bull" if i % 2 == 0 else "bear", "content": f"Argument {i} " * 50}
            for i in range(100)
        ]
        state_large = {**SAMPLE_ARCHIVAL_STATE, "messages": large_messages}
        mock_archival_repo.get_by_external_id_for_update.return_value = (
            debate_not_archived
        )
        archival_mocks["session"].execute.return_value = mock_execute_result([])
        from app.services.debate.archival import archive_debate

        await archive_debate("deb_test123", state_large)

        call_kwargs = mock_archival_repo.complete_debate.call_args[1]
        transcript = json.loads(call_kwargs["transcript"])
        assert len(transcript) == 100
        assert transcript[99]["role"] == "bear"

    @pytest.mark.asyncio
    async def test_archive_guardian_interrupts_count_accurate(
        self, archival_mocks, mock_archival_repo, debate_not_archived
    ):
        state_with_interrupts = {
            **SAMPLE_ARCHIVAL_STATE,
            "guardian_interrupts": [
                {"turn": 1, "reason": "first"},
                {"turn": 3, "reason": "second"},
                {"turn": 5, "reason": "third"},
            ],
        }
        mock_archival_repo.get_by_external_id_for_update.return_value = (
            debate_not_archived
        )
        archival_mocks["session"].execute.return_value = mock_execute_result([])
        from app.services.debate.archival import archive_debate

        await archive_debate("deb_test123", state_with_interrupts)

        call_kwargs = mock_archival_repo.complete_debate.call_args[1]
        assert call_kwargs["guardian_interrupts_count"] == 3
