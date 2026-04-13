import pytest
from datetime import datetime, timezone
from pydantic import ValidationError

from app.services.debate.schemas import (
    DebateHistoryItem,
    DebateHistoryMeta,
    StandardDebateHistoryResponse,
    DebateErrorResponse,
)


class TestDebateHistoryItemValidation:
    """P0 — DebateHistoryItem Pydantic validation (AC-7)"""

    def test_valid_minimal_fields(self):
        """ID: 4.2a-SC-001 — Minimal valid item with defaults"""
        item = DebateHistoryItem(
            external_id="ext_1",
            asset="bitcoin",
            status="completed",
            winner="bull",
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        assert item.external_id == "ext_1"
        assert item.winner == "bull"
        assert item.guardian_verdict is None
        assert item.guardian_interrupts_count == 0
        assert item.total_votes == 0
        assert item.vote_breakdown == {}
        assert item.completed_at is None

    def test_all_fields_populated(self):
        """ID: 4.2a-SC-002 — All fields populated correctly"""
        item = DebateHistoryItem(
            external_id="ext_2",
            asset="eth",
            status="completed",
            guardian_verdict="Caution",
            guardian_interrupts_count=3,
            total_votes=10,
            vote_breakdown={"bull": 6, "bear": 3, "undecided": 1},
            winner="bull",
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            completed_at=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
        )
        assert item.total_votes == 10
        assert item.vote_breakdown == {"bull": 6, "bear": 3, "undecided": 1}
        assert item.completed_at is not None

    @pytest.mark.parametrize("winner", ["bull", "bear", "undecided"])
    def test_valid_winner_values(self, winner):
        """ID: 4.2a-SC-003 — Parametrized: valid winner enum values"""
        item = DebateHistoryItem(
            external_id="ext_w",
            asset="btc",
            status="completed",
            winner=winner,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        assert item.winner == winner

    def test_missing_required_winner_raises(self):
        """ID: 4.2a-SC-004 — Missing winner raises ValidationError"""
        with pytest.raises(ValidationError) as exc_info:
            DebateHistoryItem(
                external_id="ext_no_winner",
                asset="btc",
                status="completed",
                created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            )
        assert "winner" in str(exc_info.value)

    def test_missing_required_external_id_raises(self):
        """ID: 4.2a-SC-005 — Missing external_id raises ValidationError"""
        with pytest.raises(ValidationError) as exc_info:
            DebateHistoryItem(
                asset="btc",
                status="completed",
                winner="bull",
                created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            )
        assert "external_id" in str(exc_info.value)

    def test_missing_required_created_at_raises(self):
        """ID: 4.2a-SC-006 — Missing created_at raises ValidationError"""
        with pytest.raises(ValidationError) as exc_info:
            DebateHistoryItem(
                external_id="ext_no_date",
                asset="btc",
                status="completed",
                winner="bull",
            )
        assert "created_at" in str(exc_info.value)


class TestDebateHistoryItemSerialization:
    """P0 — CamelCase serialization via alias (AC-7)"""

    def test_camel_case_serialization(self):
        """ID: 4.2a-SC-007 — All fields serialize to camelCase"""
        item = DebateHistoryItem(
            external_id="ext_camel",
            asset="btc",
            status="completed",
            guardian_verdict="Caution",
            guardian_interrupts_count=2,
            total_votes=5,
            vote_breakdown={"bull": 3, "bear": 2},
            winner="bull",
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            completed_at=datetime(2026, 1, 1, 12, tzinfo=timezone.utc),
        )
        dumped = item.model_dump(by_alias=True)

        assert "externalId" in dumped
        assert "guardianVerdict" in dumped
        assert "guardianInterruptsCount" in dumped
        assert "totalVotes" in dumped
        assert "voteBreakdown" in dumped
        assert "createdAt" in dumped
        assert "completedAt" in dumped

        assert "external_id" not in dumped
        assert "guardian_verdict" not in dumped
        assert "total_votes" not in dumped

    def test_populate_by_name_works(self):
        """ID: 4.2a-SC-008 — populate_by_name=True allows snake_case input"""
        item = DebateHistoryItem(
            external_id="ext_name",
            asset="btc",
            status="completed",
            winner="bull",
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        assert item.external_id == "ext_name"
        dumped = item.model_dump(by_alias=True)
        assert dumped["externalId"] == "ext_name"

    def test_null_guardian_verdict_serializes_as_none(self):
        """ID: 4.2a-SC-009 — Null guardian_verdict → null in output"""
        item = DebateHistoryItem(
            external_id="ext_null_gv",
            asset="btc",
            status="completed",
            guardian_verdict=None,
            winner="undecided",
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        dumped = item.model_dump(by_alias=True)
        assert dumped["guardianVerdict"] is None

    def test_null_completed_at_serializes_as_none(self):
        """ID: 4.2a-SC-010 — Null completed_at → null in output"""
        item = DebateHistoryItem(
            external_id="ext_null_ca",
            asset="btc",
            status="completed",
            winner="bull",
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
            completed_at=None,
        )
        dumped = item.model_dump(by_alias=True)
        assert dumped["completedAt"] is None


class TestDebateHistoryMetaValidation:
    """P0 — DebateHistoryMeta validation (AC-4)"""

    def test_valid_meta(self):
        """ID: 4.2a-SC-011 — Valid meta with all fields"""
        meta = DebateHistoryMeta(page=1, size=20, total=100, pages=5)
        assert meta.page == 1
        assert meta.size == 20
        assert meta.total == 100
        assert meta.pages == 5

    def test_camel_case_serialization(self):
        """ID: 4.2a-SC-012 — Meta fields serialize correctly"""
        meta = DebateHistoryMeta(page=2, size=10, total=25, pages=3)
        dumped = meta.model_dump(by_alias=True)
        assert "page" in dumped
        assert "size" in dumped
        assert "total" in dumped
        assert "pages" in dumped

    def test_zero_results_meta(self):
        """ID: 4.2a-SC-013 — Zero-results meta (total=0, pages=0)"""
        meta = DebateHistoryMeta(page=1, size=20, total=0, pages=0)
        assert meta.total == 0
        assert meta.pages == 0


class TestStandardDebateHistoryResponseValidation:
    """P0 — Standard envelope response validation (AC-4)"""

    def test_full_response_envelope(self):
        """ID: 4.2a-SC-014 — Full {data, error, meta} envelope"""
        response = StandardDebateHistoryResponse(
            data=[
                DebateHistoryItem(
                    external_id="ext_r1",
                    asset="btc",
                    status="completed",
                    winner="bull",
                    created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
                )
            ],
            error=None,
            meta=DebateHistoryMeta(page=1, size=20, total=1, pages=1),
        )
        assert len(response.data) == 1
        assert response.error is None
        assert response.meta.total == 1

    def test_empty_data_response(self):
        """ID: 4.2a-SC-015 — Empty data with zero meta"""
        response = StandardDebateHistoryResponse(
            data=[],
            error=None,
            meta=DebateHistoryMeta(page=1, size=20, total=0, pages=0),
        )
        assert response.data == []
        assert response.meta.total == 0

    def test_error_response_shape(self):
        """ID: 4.2a-SC-016 — Error response with code and message"""
        response = StandardDebateHistoryResponse(
            data=[],
            error=DebateErrorResponse(code="INVALID_ASSET", message="bad asset"),
            meta=DebateHistoryMeta(page=1, size=20, total=0, pages=0),
        )
        assert response.error is not None
        assert response.error.code == "INVALID_ASSET"
        assert response.error.message == "bad asset"

    def test_serialization_produces_correct_envelope(self):
        """ID: 4.2a-SC-017 — Full serialization round-trip"""
        response = StandardDebateHistoryResponse(
            data=[
                DebateHistoryItem(
                    external_id="ext_s1",
                    asset="btc",
                    status="completed",
                    winner="bull",
                    created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
                )
            ],
            error=None,
            meta=DebateHistoryMeta(page=1, size=20, total=1, pages=1),
        )
        dumped = response.model_dump(by_alias=True)

        assert "data" in dumped
        assert "error" in dumped
        assert "meta" in dumped
        assert dumped["error"] is None
        assert dumped["data"][0]["externalId"] == "ext_s1"
        assert dumped["meta"]["page"] == 1
