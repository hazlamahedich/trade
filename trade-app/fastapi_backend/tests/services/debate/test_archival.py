import json
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models import Debate, Vote
from app.services.debate.archival import archive_debate
from app.services.debate.repository import DebateRepository


SAMPLE_STATE = {
    "debate_id": "deb_test123",
    "asset": "bitcoin",
    "status": "completed",
    "messages": [
        {"role": "bull", "content": "Bitcoin going up!"},
        {"role": "bear", "content": "Regulatory risks ahead."},
    ],
    "current_turn": 2,
    "max_turns": 6,
    "guardian_verdict": "Caution",
    "guardian_interrupts": [{"turn": 1, "reason": "test"}],
    "paused": False,
    "pause_history": [],
}


def _mock_execute_result(rows):
    result = MagicMock()
    result.__iter__ = MagicMock(return_value=iter(rows))
    return result


class TestArchivalUnit:
    """[4-1-UNIT] Unit tests for archival service (mocked DB/Redis)."""

    @pytest.fixture
    def mock_repo(self):
        repo = MagicMock(spec=DebateRepository)
        repo.get_by_external_id = AsyncMock()
        repo.get_by_external_id_for_update = AsyncMock()
        repo.complete_debate = AsyncMock()
        return repo

    @pytest.fixture
    def mock_session(self):
        session = MagicMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        return session

    @pytest.fixture
    def debate_not_archived(self):
        debate = MagicMock(spec=Debate)
        debate.id = uuid4()
        debate.completed_at = None
        return debate

    @pytest.fixture
    def debate_already_archived(self):
        debate = MagicMock(spec=Debate)
        debate.id = uuid4()
        debate.completed_at = datetime.now(timezone.utc)
        return debate

    @pytest.mark.asyncio
    async def test_archive_persists_transcript_and_verdict(
        self, mock_repo, mock_session, debate_not_archived
    ):
        mock_repo.get_by_external_id_for_update.return_value = debate_not_archived
        mock_session.execute.return_value = _mock_execute_result(
            [("bull", 5), ("bear", 3), ("undecided", 2)]
        )

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch(
                "app.services.debate.archival.DebateRepository", return_value=mock_repo
            ):
                with patch("app.services.debate.archival.stream_state") as mock_ss:
                    mock_ss.delete_state = AsyncMock()
                    await archive_debate("deb_test123", SAMPLE_STATE)

        mock_repo.complete_debate.assert_called_once()
        call_kwargs = mock_repo.complete_debate.call_args[1]
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
        self, mock_repo, mock_session, debate_not_archived
    ):
        mock_repo.get_by_external_id_for_update.return_value = debate_not_archived
        mock_session.execute.return_value = _mock_execute_result(
            [("bull", 10), ("bear", 7), ("undecided", 3)]
        )

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch(
                "app.services.debate.archival.DebateRepository", return_value=mock_repo
            ):
                with patch("app.services.debate.archival.stream_state") as mock_ss:
                    mock_ss.delete_state = AsyncMock()
                    await archive_debate("deb_test123", SAMPLE_STATE)

        call_kwargs = mock_repo.complete_debate.call_args[1]
        assert call_kwargs["vote_bull"] == 10
        assert call_kwargs["vote_bear"] == 7
        assert call_kwargs["vote_undecided"] == 3

    @pytest.mark.asyncio
    async def test_archive_deletes_redis_state_on_success(
        self, mock_repo, mock_session, debate_not_archived
    ):
        mock_repo.get_by_external_id_for_update.return_value = debate_not_archived
        mock_session.execute.return_value = _mock_execute_result([])

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch(
                "app.services.debate.archival.DebateRepository", return_value=mock_repo
            ):
                with patch("app.services.debate.archival.stream_state") as mock_ss:
                    mock_ss.delete_state = AsyncMock()
                    await archive_debate("deb_test123", SAMPLE_STATE)

        mock_ss.delete_state.assert_called_once_with("deb_test123")

    @pytest.mark.asyncio
    async def test_archive_preserves_redis_on_db_failure(
        self, mock_repo, mock_session, debate_not_archived
    ):
        mock_repo.get_by_external_id_for_update.return_value = debate_not_archived
        mock_repo.complete_debate.side_effect = Exception("DB error")
        mock_session.execute.return_value = _mock_execute_result([])

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch(
                "app.services.debate.archival.DebateRepository", return_value=mock_repo
            ):
                with patch("app.services.debate.archival.stream_state") as mock_ss:
                    mock_ss.delete_state = AsyncMock()
                    with pytest.raises(Exception, match="DB error"):
                        await archive_debate("deb_test123", SAMPLE_STATE)

        mock_ss.delete_state.assert_not_called()

    @pytest.mark.asyncio
    async def test_archive_db_success_redis_delete_failure(
        self, mock_repo, mock_session, debate_not_archived
    ):
        mock_repo.get_by_external_id_for_update.return_value = debate_not_archived
        mock_session.execute.return_value = _mock_execute_result([])

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch(
                "app.services.debate.archival.DebateRepository", return_value=mock_repo
            ):
                with patch("app.services.debate.archival.stream_state") as mock_ss:
                    mock_ss.delete_state = AsyncMock(
                        side_effect=Exception("Redis error")
                    )
                    await archive_debate("deb_test123", SAMPLE_STATE)

        mock_repo.complete_debate.assert_called_once()

    @pytest.mark.asyncio
    async def test_archive_is_idempotent_already_archived(
        self, mock_repo, mock_session, debate_already_archived
    ):
        mock_repo.get_by_external_id_for_update.return_value = debate_already_archived

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch(
                "app.services.debate.archival.DebateRepository", return_value=mock_repo
            ):
                await archive_debate("deb_test123", SAMPLE_STATE)

        mock_repo.complete_debate.assert_not_called()

    @pytest.mark.asyncio
    async def test_archive_is_idempotent_no_state_provided_no_redis(self):
        with patch("app.services.debate.archival.stream_state") as mock_ss:
            mock_ss.get_state = AsyncMock(return_value=None)
            await archive_debate("deb_test123", state=None)

    @pytest.mark.asyncio
    async def test_archive_handles_partial_state_missing_messages(
        self, mock_repo, mock_session, debate_not_archived
    ):
        partial_state = {
            "debate_id": "deb_test123",
            "asset": "bitcoin",
            "status": "completed",
            "current_turn": 1,
        }
        mock_repo.get_by_external_id_for_update.return_value = debate_not_archived
        mock_session.execute.return_value = _mock_execute_result([])

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch(
                "app.services.debate.archival.DebateRepository", return_value=mock_repo
            ):
                with patch("app.services.debate.archival.stream_state") as mock_ss:
                    mock_ss.delete_state = AsyncMock()
                    await archive_debate("deb_test123", partial_state)

        call_kwargs = mock_repo.complete_debate.call_args[1]
        transcript = json.loads(call_kwargs["transcript"])
        assert transcript == []

    @pytest.mark.asyncio
    async def test_archive_with_no_guardian_verdict(
        self, mock_repo, mock_session, debate_not_archived
    ):
        state_no_verdict = {**SAMPLE_STATE}
        del state_no_verdict["guardian_verdict"]
        mock_repo.get_by_external_id_for_update.return_value = debate_not_archived
        mock_session.execute.return_value = _mock_execute_result([])

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch(
                "app.services.debate.archival.DebateRepository", return_value=mock_repo
            ):
                with patch("app.services.debate.archival.stream_state") as mock_ss:
                    mock_ss.delete_state = AsyncMock()
                    await archive_debate("deb_test123", state_no_verdict)

        call_kwargs = mock_repo.complete_debate.call_args[1]
        assert call_kwargs["guardian_verdict"] is None

    @pytest.mark.asyncio
    async def test_archive_with_zero_votes(
        self, mock_repo, mock_session, debate_not_archived
    ):
        mock_repo.get_by_external_id_for_update.return_value = debate_not_archived
        mock_session.execute.return_value = _mock_execute_result([])

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch(
                "app.services.debate.archival.DebateRepository", return_value=mock_repo
            ):
                with patch("app.services.debate.archival.stream_state") as mock_ss:
                    mock_ss.delete_state = AsyncMock()
                    await archive_debate("deb_test123", SAMPLE_STATE)

        call_kwargs = mock_repo.complete_debate.call_args[1]
        assert call_kwargs["vote_bull"] == 0
        assert call_kwargs["vote_bear"] == 0
        assert call_kwargs["vote_undecided"] == 0


class TestArchivalEngineWiring:
    """[4-1-UNIT] Tests for archival wiring into stream_debate."""

    @pytest.mark.asyncio
    async def test_stream_debate_calls_archive_on_completion(self):
        from app.services.debate.engine import stream_debate
        from tests.services.debate.test_helpers import patched_debate_engine

        mock_manager = MagicMock()
        mock_manager.broadcast_to_debate = AsyncMock()
        mock_manager.active_debates = {}

        async def safe_analyze(state):
            return {
                "should_interrupt": False,
                "risk_level": "low",
                "reason": "ok",
                "fallacy_type": None,
                "summary_verdict": "Wait",
                "safe": True,
                "detailed_reasoning": "",
            }

        with patched_debate_engine(safe_analyze) as _mocks:
            with patch("app.services.debate.engine.archive_debate") as mock_archive:
                mock_archive.return_value = AsyncMock()
                with patch(
                    "app.services.debate.engine.StaleDataGuardian"
                ) as mock_sg_cls:
                    from app.services.market.schemas import FreshnessStatus

                    mock_sg = MagicMock()
                    mock_sg.get_freshness_status = AsyncMock(
                        return_value=FreshnessStatus(
                            asset="BTC",
                            is_stale=False,
                            last_update=datetime.now(timezone.utc),
                            age_seconds=5,
                            threshold_seconds=60,
                        )
                    )
                    mock_sg_cls.return_value = mock_sg

                    await stream_debate(
                        debate_id="deb_test123",
                        asset="bitcoin",
                        market_context={"summary": "test"},
                        manager=mock_manager,
                        max_turns=2,
                    )

        mock_archive.assert_called_once()
        call_args = mock_archive.call_args
        assert call_args[0][0] == "deb_test123"

    @pytest.mark.asyncio
    async def test_stream_debate_calls_archive_on_critical_interrupt(self):
        from app.services.debate.engine import stream_debate
        from tests.services.debate.test_helpers import patched_debate_engine

        mock_manager = MagicMock()
        mock_manager.broadcast_to_debate = AsyncMock()
        mock_manager.active_debates = {}

        analyze_call_count = [0]

        async def critical_analyze(state):
            analyze_call_count[0] += 1
            if analyze_call_count[0] == 1:
                return {
                    "should_interrupt": True,
                    "risk_level": "critical",
                    "reason": "Dangerous",
                    "fallacy_type": None,
                    "summary_verdict": "High Risk",
                    "safe": False,
                    "detailed_reasoning": "",
                }
            return {
                "should_interrupt": False,
                "risk_level": "low",
                "reason": "ok",
                "fallacy_type": None,
                "summary_verdict": "Wait",
                "safe": True,
                "detailed_reasoning": "",
            }

        with patched_debate_engine(critical_analyze) as _mocks:
            with patch("app.services.debate.engine.archive_debate") as mock_archive:
                mock_archive.return_value = AsyncMock()
                with patch(
                    "app.services.debate.engine.StaleDataGuardian"
                ) as mock_sg_cls:
                    from app.services.market.schemas import FreshnessStatus

                    mock_sg = MagicMock()
                    mock_sg.get_freshness_status = AsyncMock(
                        return_value=FreshnessStatus(
                            asset="BTC",
                            is_stale=False,
                            last_update=datetime.now(timezone.utc),
                            age_seconds=5,
                            threshold_seconds=60,
                        )
                    )
                    mock_sg_cls.return_value = mock_sg

                    await stream_debate(
                        debate_id="deb_critical",
                        asset="bitcoin",
                        market_context={"summary": "test"},
                        manager=mock_manager,
                        max_turns=2,
                    )

        mock_archive.assert_called_once()
        assert mock_archive.call_args[0][0] == "deb_critical"

    @pytest.mark.asyncio
    async def test_debate_completes_even_if_archival_fails(self):
        from app.services.debate.engine import stream_debate
        from tests.services.debate.test_helpers import patched_debate_engine

        mock_manager = MagicMock()
        mock_manager.broadcast_to_debate = AsyncMock()
        mock_manager.active_debates = {}

        async def safe_analyze(state):
            return {
                "should_interrupt": False,
                "risk_level": "low",
                "reason": "ok",
                "fallacy_type": None,
                "summary_verdict": "Wait",
                "safe": True,
                "detailed_reasoning": "",
            }

        with patched_debate_engine(safe_analyze) as _mocks:
            with patch("app.services.debate.engine.archive_debate") as mock_archive:
                mock_archive.side_effect = Exception("Archival exploded")
                with patch(
                    "app.services.debate.engine.StaleDataGuardian"
                ) as mock_sg_cls:
                    from app.services.market.schemas import FreshnessStatus

                    mock_sg = MagicMock()
                    mock_sg.get_freshness_status = AsyncMock(
                        return_value=FreshnessStatus(
                            asset="BTC",
                            is_stale=False,
                            last_update=datetime.now(timezone.utc),
                            age_seconds=5,
                            threshold_seconds=60,
                        )
                    )
                    mock_sg_cls.return_value = mock_sg

                    result = await stream_debate(
                        debate_id="deb_archfail",
                        asset="bitcoin",
                        market_context={"summary": "test"},
                        manager=mock_manager,
                        max_turns=2,
                    )

        assert result["status"] == "completed"

    @pytest.mark.asyncio
    async def test_stream_debate_error_path_does_not_archive(self):
        from app.services.debate.engine import stream_debate
        from tests.services.debate.test_helpers import patched_debate_engine

        mock_manager = MagicMock()
        mock_manager.broadcast_to_debate = AsyncMock()
        mock_manager.active_debates = {}

        async def safe_analyze(state):
            return {
                "should_interrupt": False,
                "risk_level": "low",
                "reason": "ok",
                "fallacy_type": None,
                "summary_verdict": "Wait",
                "safe": True,
                "detailed_reasoning": "",
            }

        with patched_debate_engine(safe_analyze) as mocks:
            mocks["stream_state"].save_state = AsyncMock(
                side_effect=Exception("Redis down")
            )
            with patch("app.services.debate.engine.archive_debate") as mock_archive:
                with patch(
                    "app.services.debate.engine.StaleDataGuardian"
                ) as mock_sg_cls:
                    from app.services.market.schemas import FreshnessStatus

                    mock_sg = MagicMock()
                    mock_sg.get_freshness_status = AsyncMock(
                        return_value=FreshnessStatus(
                            asset="BTC",
                            is_stale=False,
                            last_update=datetime.now(timezone.utc),
                            age_seconds=5,
                            threshold_seconds=60,
                        )
                    )
                    mock_sg_cls.return_value = mock_sg

                    with pytest.raises(Exception):
                        await stream_debate(
                            debate_id="deb_err",
                            asset="bitcoin",
                            market_context={"summary": "test"},
                            manager=mock_manager,
                            max_turns=2,
                        )

        mock_archive.assert_not_called()


class TestArchivalIntegration:
    """[4-1-INT] Integration tests using real PostgreSQL."""

    @pytest.mark.asyncio
    async def test_archive_persists_to_real_postgres(self, db_session):
        debate = Debate(
            external_id="deb_archive_int",
            asset="bitcoin",
            status="running",
            max_turns=6,
            current_turn=4,
            guardian_interrupts_count=1,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        vote1 = Vote(debate_id=debate.id, choice="bull", voter_fingerprint="fp_1")
        vote2 = Vote(debate_id=debate.id, choice="bull", voter_fingerprint="fp_2")
        vote3 = Vote(debate_id=debate.id, choice="bear", voter_fingerprint="fp_3")
        db_session.add_all([vote1, vote2, vote3])
        await db_session.commit()

        state = {
            "messages": [
                {"role": "bull", "content": "Bull case"},
                {"role": "bear", "content": "Bear case"},
            ],
            "guardian_verdict": "Caution",
            "guardian_interrupts": [{"turn": 2, "reason": "test"}],
            "current_turn": 4,
        }

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=db_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch("app.services.debate.archival.stream_state") as mock_ss:
                mock_ss.delete_state = AsyncMock()
                await archive_debate("deb_archive_int", state)

        from sqlalchemy import select

        stmt = select(Debate).where(Debate.external_id == "deb_archive_int")
        result = await db_session.execute(stmt)
        refreshed = result.scalar_one()

        assert refreshed.status == "completed"
        assert refreshed.completed_at is not None
        assert refreshed.guardian_verdict == "Caution"
        assert refreshed.guardian_interrupts_count == 1
        assert refreshed.current_turn == 4
        assert refreshed.vote_bull == 2
        assert refreshed.vote_bear == 1
        assert refreshed.vote_undecided == 0
        transcript = json.loads(refreshed.transcript)
        assert len(transcript) == 2
        assert transcript[0]["role"] == "bull"

    @pytest.mark.asyncio
    async def test_archive_transcript_is_valid_json(self, db_session):
        debate = Debate(
            external_id="deb_json_roundtrip",
            asset="ethereum",
            status="running",
            max_turns=6,
            current_turn=2,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        messages = [
            {"role": "bull", "content": "ETH to the moon!"},
            {"role": "bear", "content": "ETH is overvalued."},
            {"role": "guardian", "content": "Caution advised.", "risk_level": "medium"},
        ]
        state = {
            "messages": messages,
            "current_turn": 2,
        }

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=db_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch("app.services.debate.archival.stream_state") as mock_ss:
                mock_ss.delete_state = AsyncMock()
                await archive_debate("deb_json_roundtrip", state)

        from sqlalchemy import select

        stmt = select(Debate).where(Debate.external_id == "deb_json_roundtrip")
        result = await db_session.execute(stmt)
        refreshed = result.scalar_one()

        round_tripped = json.loads(refreshed.transcript)
        assert round_tripped == messages
        roles = [m["role"] for m in round_tripped]
        assert "bull" in roles
        assert "bear" in roles
        assert "guardian" in roles


class TestArchivalExtendedUnit:
    """[4-1-UNIT] Extended coverage: edge cases, review findings, error paths."""

    @pytest.fixture
    def mock_repo(self):
        repo = MagicMock(spec=DebateRepository)
        repo.get_by_external_id = AsyncMock()
        repo.get_by_external_id_for_update = AsyncMock()
        repo.complete_debate = AsyncMock()
        return repo

    @pytest.fixture
    def mock_session(self):
        session = MagicMock()
        session.execute = AsyncMock()
        session.commit = AsyncMock()
        return session

    @pytest.fixture
    def debate_not_archived(self):
        debate = MagicMock(spec=Debate)
        debate.id = uuid4()
        debate.completed_at = None
        return debate

    @pytest.mark.asyncio
    async def test_archive_debate_not_found_in_db(self, mock_repo, mock_session):
        mock_repo.get_by_external_id_for_update.return_value = None

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch(
                "app.services.debate.archival.DebateRepository", return_value=mock_repo
            ):
                await archive_debate("deb_nonexistent", SAMPLE_STATE)

        mock_repo.complete_debate.assert_not_called()

    @pytest.mark.asyncio
    async def test_archive_non_list_guardian_interrupts(
        self, mock_repo, mock_session, debate_not_archived
    ):
        state_bad_interrupts = {
            **SAMPLE_STATE,
            "guardian_interrupts": "corrupted_string",
        }
        mock_repo.get_by_external_id_for_update.return_value = debate_not_archived
        mock_session.execute.return_value = _mock_execute_result([])

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch(
                "app.services.debate.archival.DebateRepository", return_value=mock_repo
            ):
                with patch("app.services.debate.archival.stream_state") as mock_ss:
                    mock_ss.delete_state = AsyncMock()
                    await archive_debate("deb_test123", state_bad_interrupts)

        call_kwargs = mock_repo.complete_debate.call_args[1]
        assert call_kwargs["guardian_interrupts_count"] == 0

    @pytest.mark.asyncio
    async def test_archive_empty_messages_list(
        self, mock_repo, mock_session, debate_not_archived
    ):
        state_empty = {**SAMPLE_STATE, "messages": []}
        mock_repo.get_by_external_id_for_update.return_value = debate_not_archived
        mock_session.execute.return_value = _mock_execute_result([])

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch(
                "app.services.debate.archival.DebateRepository", return_value=mock_repo
            ):
                with patch("app.services.debate.archival.stream_state") as mock_ss:
                    mock_ss.delete_state = AsyncMock()
                    await archive_debate("deb_test123", state_empty)

        call_kwargs = mock_repo.complete_debate.call_args[1]
        assert json.loads(call_kwargs["transcript"]) == []

    @pytest.mark.asyncio
    async def test_archive_unexpected_vote_choices_ignored(
        self, mock_repo, mock_session, debate_not_archived
    ):
        mock_repo.get_by_external_id_for_update.return_value = debate_not_archived
        mock_session.execute.return_value = _mock_execute_result(
            [("bull", 5), ("invalid_choice", 3)]
        )

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch(
                "app.services.debate.archival.DebateRepository", return_value=mock_repo
            ):
                with patch("app.services.debate.archival.stream_state") as mock_ss:
                    mock_ss.delete_state = AsyncMock()
                    await archive_debate("deb_test123", SAMPLE_STATE)

        call_kwargs = mock_repo.complete_debate.call_args[1]
        assert call_kwargs["vote_bull"] == 5
        assert call_kwargs["vote_bear"] == 0
        assert call_kwargs["vote_undecided"] == 0

    @pytest.mark.asyncio
    async def test_archive_redis_fallback_path(
        self, mock_repo, mock_session, debate_not_archived
    ):
        redis_state = {
            "messages": [{"role": "bull", "content": "From Redis"}],
            "guardian_verdict": "Low Risk",
            "guardian_interrupts": [],
            "current_turn": 3,
        }
        mock_repo.get_by_external_id_for_update.return_value = debate_not_archived
        mock_session.execute.return_value = _mock_execute_result([])

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch(
                "app.services.debate.archival.DebateRepository", return_value=mock_repo
            ):
                with patch("app.services.debate.archival.stream_state") as mock_ss:
                    mock_ss.get_state = AsyncMock(return_value=redis_state)
                    mock_ss.delete_state = AsyncMock()
                    await archive_debate("deb_test123", state=None)

        mock_repo.complete_debate.assert_called_once()
        call_kwargs = mock_repo.complete_debate.call_args[1]
        assert call_kwargs["current_turn"] == 3

    @pytest.mark.asyncio
    async def test_archive_large_transcript(
        self, mock_repo, mock_session, debate_not_archived
    ):
        large_messages = [
            {"role": "bull" if i % 2 == 0 else "bear", "content": f"Argument {i} " * 50}
            for i in range(100)
        ]
        state_large = {**SAMPLE_STATE, "messages": large_messages}
        mock_repo.get_by_external_id_for_update.return_value = debate_not_archived
        mock_session.execute.return_value = _mock_execute_result([])

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch(
                "app.services.debate.archival.DebateRepository", return_value=mock_repo
            ):
                with patch("app.services.debate.archival.stream_state") as mock_ss:
                    mock_ss.delete_state = AsyncMock()
                    await archive_debate("deb_test123", state_large)

        call_kwargs = mock_repo.complete_debate.call_args[1]
        transcript = json.loads(call_kwargs["transcript"])
        assert len(transcript) == 100
        assert transcript[99]["role"] == "bear"

    @pytest.mark.asyncio
    async def test_archive_guardian_interrupts_count_accurate(
        self, mock_repo, mock_session, debate_not_archived
    ):
        state_with_interrupts = {
            **SAMPLE_STATE,
            "guardian_interrupts": [
                {"turn": 1, "reason": "first"},
                {"turn": 3, "reason": "second"},
                {"turn": 5, "reason": "third"},
            ],
        }
        mock_repo.get_by_external_id_for_update.return_value = debate_not_archived
        mock_session.execute.return_value = _mock_execute_result([])

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch(
                "app.services.debate.archival.DebateRepository", return_value=mock_repo
            ):
                with patch("app.services.debate.archival.stream_state") as mock_ss:
                    mock_ss.delete_state = AsyncMock()
                    await archive_debate("deb_test123", state_with_interrupts)

        call_kwargs = mock_repo.complete_debate.call_args[1]
        assert call_kwargs["guardian_interrupts_count"] == 3


class TestRepositoryVoteColumnGuards:
    """[4-1-UNIT] Verify complete_debate vote column guards from review finding."""

    @pytest.mark.asyncio
    async def test_complete_debate_sets_vote_columns(self, db_session):
        debate = Debate(
            external_id="deb_vote_guard",
            asset="bitcoin",
            status="running",
            max_turns=6,
            current_turn=4,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        repo = DebateRepository(db_session)
        result = await repo.complete_debate(
            external_id="deb_vote_guard",
            guardian_verdict="Caution",
            guardian_interrupts_count=2,
            transcript='[{"role":"bull","content":"test"}]',
            current_turn=4,
            vote_bull=10,
            vote_bear=5,
            vote_undecided=3,
        )

        assert result is not None
        assert result.vote_bull == 10
        assert result.vote_bear == 5
        assert result.vote_undecided == 3

    @pytest.mark.asyncio
    async def test_complete_debate_does_not_overwrite_with_none(self, db_session):
        debate = Debate(
            external_id="deb_vote_none",
            asset="bitcoin",
            status="running",
            max_turns=6,
            current_turn=4,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        repo = DebateRepository(db_session)
        await repo.complete_debate(
            external_id="deb_vote_none",
            vote_bull=10,
            vote_bear=5,
            vote_undecided=3,
        )

        debate_after = await repo.get_by_external_id("deb_vote_none")
        original_bull = debate_after.vote_bull

        await repo.complete_debate(
            external_id="deb_vote_none",
            vote_bull=None,
            vote_bear=None,
            vote_undecided=None,
        )

        debate_final = await repo.get_by_external_id("deb_vote_none")
        assert debate_final.vote_bull == original_bull


class TestArchivalExtendedIntegration:
    """[4-1-INT] Extended integration: idempotency, full flow, model columns."""

    @pytest.mark.asyncio
    async def test_idempotency_under_real_postgres(self, db_session):
        debate = Debate(
            external_id="deb_idempotent",
            asset="bitcoin",
            status="running",
            max_turns=6,
            current_turn=2,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        state = {
            "messages": [{"role": "bull", "content": "Bull"}],
            "current_turn": 2,
        }

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=db_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch("app.services.debate.archival.stream_state") as mock_ss:
                mock_ss.delete_state = AsyncMock()
                await archive_debate("deb_idempotent", state)

        from sqlalchemy import select

        stmt = select(Debate).where(Debate.external_id == "deb_idempotent")
        result = await db_session.execute(stmt)
        refreshed = result.scalar_one()
        assert refreshed.status == "completed"
        first_completed_at = refreshed.completed_at

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=db_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch("app.services.debate.archival.stream_state") as mock_ss:
                mock_ss.delete_state = AsyncMock()
                await archive_debate("deb_idempotent", state)

        result2 = await db_session.execute(stmt)
        refreshed2 = result2.scalar_one()
        assert refreshed2.completed_at == first_completed_at

    @pytest.mark.asyncio
    async def test_debate_model_has_vote_columns(self, db_session):
        debate = Debate(
            external_id="deb_model_cols",
            asset="ethereum",
            status="running",
            max_turns=6,
            current_turn=0,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        assert hasattr(debate, "vote_bull")
        assert hasattr(debate, "vote_bear")
        assert hasattr(debate, "vote_undecided")
        assert debate.vote_bull is None
        assert debate.vote_bear is None
        assert debate.vote_undecided is None

    @pytest.mark.asyncio
    async def test_full_archival_flow_with_votes(self, db_session):
        debate = Debate(
            external_id="deb_full_flow",
            asset="bitcoin",
            status="running",
            max_turns=6,
            current_turn=6,
            guardian_interrupts_count=1,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        for i, choice in enumerate(
            ["bull", "bull", "bull", "bear", "bear", "undecided"]
        ):
            vote = Vote(
                debate_id=debate.id,
                choice=choice,
                voter_fingerprint=f"fp_full_{i}",
            )
            db_session.add(vote)
        await db_session.commit()

        state = {
            "messages": [{"role": "bull", "content": f"Bull arg {i}"} for i in range(3)]
            + [{"role": "bear", "content": f"Bear arg {i}"} for i in range(3)],
            "guardian_verdict": "High Risk / Wait",
            "guardian_interrupts": [{"turn": 2, "reason": "test interrupt"}],
            "current_turn": 6,
        }

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=db_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch("app.services.debate.archival.stream_state") as mock_ss:
                mock_ss.delete_state = AsyncMock()
                await archive_debate("deb_full_flow", state)

        from sqlalchemy import select

        stmt = select(Debate).where(Debate.external_id == "deb_full_flow")
        result = await db_session.execute(stmt)
        refreshed = result.scalar_one()

        assert refreshed.status == "completed"
        assert refreshed.completed_at is not None
        assert refreshed.guardian_verdict == "High Risk / Wait"
        assert refreshed.guardian_interrupts_count == 1
        assert refreshed.current_turn == 6
        assert refreshed.vote_bull == 3
        assert refreshed.vote_bear == 2
        assert refreshed.vote_undecided == 1

        transcript = json.loads(refreshed.transcript)
        assert len(transcript) == 6
        roles = [m["role"] for m in transcript]
        assert roles.count("bull") == 3
        assert roles.count("bear") == 3
