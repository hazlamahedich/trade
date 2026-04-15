from datetime import datetime, timezone

from app.services.debate.schemas import (
    ActiveDebateSummary,
    StandardActiveDebateResponse,
)


class TestActiveDebateSummaryStatusSerializer:
    def test_running_maps_to_active(self):
        summary = ActiveDebateSummary(
            id="deb_1",
            asset="btc",
            status="running",
            started_at=datetime(2026, 4, 15, 10, 30, tzinfo=timezone.utc),
            viewer_count=None,
        )
        dumped = summary.model_dump(by_alias=True)
        assert dumped["status"] == "active"

    def test_completed_stays_completed(self):
        summary = ActiveDebateSummary(
            id="deb_2",
            asset="eth",
            status="completed",
            started_at=datetime(2026, 4, 15, 10, 30, tzinfo=timezone.utc),
            viewer_count=None,
        )
        dumped = summary.model_dump(by_alias=True)
        assert dumped["status"] == "completed"

    def test_active_stays_active(self):
        summary = ActiveDebateSummary(
            id="deb_3",
            asset="sol",
            status="active",
            started_at=datetime(2026, 4, 15, 10, 30, tzinfo=timezone.utc),
            viewer_count=None,
        )
        dumped = summary.model_dump(by_alias=True)
        assert dumped["status"] == "active"

    def test_unknown_status_passes_through(self):
        summary = ActiveDebateSummary(
            id="deb_4",
            asset="btc",
            status="scheduled",
            started_at=datetime(2026, 4, 15, 10, 30, tzinfo=timezone.utc),
            viewer_count=None,
        )
        dumped = summary.model_dump(by_alias=True)
        assert dumped["status"] == "scheduled"


class TestActiveDebateSummaryFieldAliases:
    def test_uses_camel_case_aliases(self):
        summary = ActiveDebateSummary(
            id="deb_5",
            asset="btc",
            status="running",
            started_at=datetime(2026, 4, 15, 10, 30, tzinfo=timezone.utc),
            viewer_count=42,
        )
        dumped = summary.model_dump(by_alias=True)
        assert "startedAt" in dumped
        assert "viewerCount" in dumped
        assert "started_at" not in dumped
        assert "viewer_count" not in dumped

    def test_null_viewer_count(self):
        summary = ActiveDebateSummary(
            id="deb_6",
            asset="btc",
            status="running",
            started_at=datetime(2026, 4, 15, 10, 30, tzinfo=timezone.utc),
            viewer_count=None,
        )
        dumped = summary.model_dump(by_alias=True)
        assert dumped["viewerCount"] is None


class TestStandardActiveDebateResponse:
    def test_null_data_response(self):
        resp = StandardActiveDebateResponse(
            data=None,
            error=None,
            meta={},
        )
        dumped = resp.model_dump(by_alias=True)
        assert dumped["data"] is None
        assert dumped["error"] is None

    def test_with_active_debate_data(self):
        summary = ActiveDebateSummary(
            id="deb_7",
            asset="btc",
            status="running",
            started_at=datetime(2026, 4, 15, 10, 30, tzinfo=timezone.utc),
            viewer_count=None,
        )
        resp = StandardActiveDebateResponse(data=summary)
        dumped = resp.model_dump(by_alias=True)
        assert dumped["data"]["status"] == "active"
        assert dumped["data"]["id"] == "deb_7"
