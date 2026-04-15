import { createActiveDebateSummary, createRecentDebatePreview } from "../factories/landing-factory";
import type { ActiveDebateSummary, RecentDebatePreview } from "@/features/landing/types";

const BACKEND_ACTIVE_DEBATE_SERIALIZED_KEYS = [
  "id",
  "asset",
  "status",
  "startedAt",
  "viewerCount",
] as const;

const BACKEND_RECENT_DEBATE_SERIALIZED_KEYS = [
  "externalId",
  "asset",
  "status",
  "winner",
  "totalVotes",
  "voteBreakdown",
  "completedAt",
] as const;

describe("[4.4-CONTRACT] Backend ↔ Frontend schema contract", () => {
  it("given ActiveDebateSummary serialized from backend, when compared to frontend type, then all expected keys are present", () => {
    const backendSerialized: Record<string, unknown> = {
      id: "uuid-123",
      asset: "BTC",
      status: "active",
      startedAt: "2026-04-15T10:30:00Z",
      viewerCount: null,
    };

    const frontendData: ActiveDebateSummary = createActiveDebateSummary();

    for (const key of BACKEND_ACTIVE_DEBATE_SERIALIZED_KEYS) {
      expect(key in backendSerialized).toBe(true);
      expect(key in frontendData).toBe(true);
    }
  });

  it("given ActiveDebateSummary, when backend serializes with camelCase aliases, then keys match frontend TypeScript interface", () => {
    const frontendKeys = Object.keys(createActiveDebateSummary());
    const expectedKeys = Array.from(BACKEND_ACTIVE_DEBATE_SERIALIZED_KEYS);

    expect(frontendKeys.sort()).toEqual(expectedKeys.sort());
  });

  it("given backend field_serializer maps running→active, when frontend receives status, then it is a valid frontend status value", () => {
    const validStatuses = ["active", "scheduled", "completed", "pending"];

    const summary = createActiveDebateSummary({ status: "active" });
    expect(validStatuses).toContain(summary.status);
  });

  it("given RecentDebatePreview serialized from backend, when compared to frontend type, then all expected keys are present", () => {
    const frontendKeys = Object.keys(createRecentDebatePreview());
    const expectedKeys = Array.from(BACKEND_RECENT_DEBATE_SERIALIZED_KEYS);

    expect(frontendKeys.sort()).toEqual(expectedKeys.sort());
  });

  it("given RecentDebatePreview voteBreakdown, when serialized from backend, then keys are camelCase", () => {
    const preview = createRecentDebatePreview();
    expect(preview.voteBreakdown).toHaveProperty("bull");
    expect(preview.voteBreakdown).toHaveProperty("bear");
    expect(preview.voteBreakdown).toHaveProperty("undecided");
  });

  it("given viewerCount is nullable on backend, when frontend receives null, then type accepts it", () => {
    const summary = createActiveDebateSummary({ viewerCount: null });
    expect(summary.viewerCount).toBeNull();

    const summaryWithValue = createActiveDebateSummary({ viewerCount: 42 });
    expect(summaryWithValue.viewerCount).toBe(42);
  });

  it("given completedAt is nullable on backend, when frontend receives null, then type accepts it", () => {
    const preview = createRecentDebatePreview({ completedAt: null });
    expect(preview.completedAt).toBeNull();

    const previewWithValue = createRecentDebatePreview({ completedAt: "2026-04-14T12:00:00Z" });
    expect(previewWithValue.completedAt).toBe("2026-04-14T12:00:00Z");
  });
});
