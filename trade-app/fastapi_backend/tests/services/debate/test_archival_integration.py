import json
from unittest.mock import AsyncMock, patch

import pytest

from app.models import Debate, PendingArchive, Vote
from app.services.debate.archival import archive_debate, archive_with_retry
from app.services.debate.repository import DebateRepository
from sqlalchemy import select


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

        stmt = select(Debate).where(Debate.external_id == "deb_json_roundtrip")
        result = await db_session.execute(stmt)
        refreshed = result.scalar_one()

        round_tripped = json.loads(refreshed.transcript)
        assert round_tripped == messages
        roles = [m["role"] for m in round_tripped]
        assert "bull" in roles
        assert "bear" in roles
        assert "guardian" in roles


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


class TestArchivalRetryAndConcurrency:
    """[4-1-INT] Retry wrapper, concurrent archival, large transcript tests."""

    @pytest.mark.priority("P1")
    @pytest.mark.asyncio
    async def test_4_1_int_008_sequential_idempotent_no_double_archive(
        self, db_session
    ):
        debate = Debate(
            external_id="deb_concurrent",
            asset="bitcoin",
            status="running",
            max_turns=6,
            current_turn=4,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        state = {
            "messages": [{"role": "bull", "content": "Bull"}],
            "guardian_verdict": "Caution",
            "guardian_interrupts": [],
            "current_turn": 4,
        }

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=db_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch("app.services.debate.archival.stream_state") as mock_ss:
                mock_ss.delete_state = AsyncMock()
                await archive_debate("deb_concurrent", state)

        stmt = select(Debate).where(Debate.external_id == "deb_concurrent")
        result = await db_session.execute(stmt)
        refreshed = result.scalar_one()
        first_completed_at = refreshed.completed_at
        assert refreshed.status == "completed"

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=db_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch("app.services.debate.archival.stream_state") as mock_ss:
                mock_ss.delete_state = AsyncMock()
                await archive_debate("deb_concurrent", state)

        result2 = await db_session.execute(stmt)
        refreshed2 = result2.scalar_one()
        assert refreshed2.completed_at == first_completed_at
        assert refreshed2.status == "completed"

    @pytest.mark.priority("P1")
    @pytest.mark.asyncio
    async def test_4_1_int_009_large_transcript_toast_round_trip(self, db_session):
        debate = Debate(
            external_id="deb_large_transcript",
            asset="bitcoin",
            status="running",
            max_turns=100,
            current_turn=0,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        messages = []
        current_size = 0
        target_bytes = 150_000
        turn = 0
        while current_size < target_bytes:
            turn += 1
            msg = {
                "role": "bull" if turn % 2 == 1 else "bear",
                "content": (
                    f"Turn {turn} argument: "
                    "The fundamental analysis supports the thesis based on "
                    "revenue growth of 23% YoY, expanding gross margins from "
                    "65% to 68%, and accelerating enterprise adoption. " + "x" * 350
                ),
                "turn_number": turn,
            }
            messages.append(msg)
            current_size += len(json.dumps(msg))

        state = {
            "messages": messages,
            "current_turn": len(messages),
        }
        transcript_json = json.dumps(messages)
        assert len(transcript_json) > 100_000

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=db_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch("app.services.debate.archival.stream_state") as mock_ss:
                mock_ss.delete_state = AsyncMock()
                await archive_debate("deb_large_transcript", state)

        stmt = select(Debate).where(Debate.external_id == "deb_large_transcript")
        result = await db_session.execute(stmt)
        refreshed = result.scalar_one()

        assert refreshed.status == "completed"
        round_tripped = json.loads(refreshed.transcript)
        assert len(round_tripped) == len(messages)
        assert round_tripped[0]["role"] == "bull"
        assert round_tripped[-1]["turn_number"] == len(messages)

    @pytest.mark.priority("P1")
    @pytest.mark.asyncio
    async def test_4_1_int_010_archive_with_retry_succeeds_on_second_attempt(
        self, db_session
    ):
        debate = Debate(
            external_id="deb_retry",
            asset="ethereum",
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

        call_count = [0]

        async def flaky_archive(debate_id, s):
            call_count[0] += 1
            if call_count[0] == 1:
                raise ConnectionError("DB connection lost")

        with patch(
            "app.services.debate.archival.archive_debate",
            side_effect=flaky_archive,
        ):
            result = await archive_with_retry("deb_retry", state)

        assert result is True
        assert call_count[0] == 2

    @pytest.mark.priority("P2")
    @pytest.mark.asyncio
    async def test_4_1_int_011_archive_with_retry_exhausts_attempts(self):
        with patch(
            "app.services.debate.archival.archive_debate",
            side_effect=ConnectionError("DB down"),
        ):
            result = await archive_with_retry("deb_exhaust", {"messages": []})

        assert result is False

    @pytest.mark.priority("P2")
    @pytest.mark.asyncio
    async def test_4_1_int_012_sweeper_resolves_pending_archive(self, db_session):
        from app.services.debate.archival_sweeper import retry_pending_archives

        state = {
            "messages": [{"role": "bull", "content": "Sweeper test"}],
            "current_turn": 1,
        }

        debate = Debate(
            external_id="deb_sweeper",
            asset="bitcoin",
            status="running",
            max_turns=6,
            current_turn=1,
        )
        db_session.add(debate)
        await db_session.commit()
        await db_session.refresh(debate)

        pending = PendingArchive(
            debate_external_id="deb_sweeper",
            full_state=state,
            attempt_count=0,
        )
        db_session.add(pending)
        await db_session.commit()

        with patch("app.services.debate.archival.async_session_maker") as mock_sf:
            mock_sf.return_value.__aenter__ = AsyncMock(return_value=db_session)
            mock_sf.return_value.__aexit__ = AsyncMock(return_value=False)
            with patch(
                "app.services.debate.archival_sweeper.async_session_maker"
            ) as sw_sf:
                sw_sf.return_value.__aenter__ = AsyncMock(return_value=db_session)
                sw_sf.return_value.__aexit__ = AsyncMock(return_value=False)
                with patch("app.services.debate.archival.stream_state") as mock_ss:
                    mock_ss.delete_state = AsyncMock()
                    count = await retry_pending_archives()

        assert count == 1

        stmt = select(Debate).where(Debate.external_id == "deb_sweeper")
        result = await db_session.execute(stmt)
        refreshed = result.scalar_one()
        assert refreshed.status == "completed"

    @pytest.mark.priority("P2")
    @pytest.mark.asyncio
    async def test_4_1_int_013_pending_archive_model_exists(self, db_session):
        pending = PendingArchive(
            debate_external_id="deb_model_test",
            full_state={"messages": [], "current_turn": 0},
        )
        db_session.add(pending)
        await db_session.commit()
        await db_session.refresh(pending)

        assert pending.id is not None
        assert pending.attempt_count == 0
        assert pending.max_attempts == 10
        assert pending.resolved_at is None
        assert pending.created_at is not None
