import { formatRelativeTime } from "@/features/debate/utils/format-time";

describe("formatRelativeTime", () => {
  const now = new Date("2026-04-14T12:00:00Z");

  it("returns 'just now' for dates less than 1 minute ago", () => {
    expect(formatRelativeTime("2026-04-14T11:59:30Z", now)).toBe("just now");
  });

  it("returns minutes ago for dates within the last hour", () => {
    expect(formatRelativeTime("2026-04-14T11:30:00Z", now)).toBe("30m ago");
  });

  it("returns hours ago for dates within the last day", () => {
    expect(formatRelativeTime("2026-04-14T06:00:00Z", now)).toBe("6h ago");
  });

  it("returns days ago for dates within the last 30 days", () => {
    expect(formatRelativeTime("2026-04-10T12:00:00Z", now)).toBe("4d ago");
  });

  it("returns locale date string for dates older than 30 days", () => {
    const result = formatRelativeTime("2026-02-01T12:00:00Z", now);
    expect(result).not.toMatch(/\d+[mhd] ago/);
    expect(result).not.toBe("just now");
  });

  it("returns 'just now' for exactly 0 diff", () => {
    expect(formatRelativeTime("2026-04-14T12:00:00Z", now)).toBe("just now");
  });

  it("returns 1m ago for exactly 1 minute ago", () => {
    expect(formatRelativeTime("2026-04-14T11:59:00Z", now)).toBe("1m ago");
  });

  it("returns 1h ago for exactly 60 minutes ago", () => {
    expect(formatRelativeTime("2026-04-14T11:00:00Z", now)).toBe("1h ago");
  });

  it("returns 1d ago for exactly 24 hours ago", () => {
    expect(formatRelativeTime("2026-04-13T12:00:00Z", now)).toBe("1d ago");
  });

  it("returns 29d ago for 29 days ago", () => {
    expect(formatRelativeTime("2026-03-16T12:00:00Z", now)).toBe("29d ago");
  });

  it("defaults to current time when now param omitted", () => {
    const justNow = new Date().toISOString();
    expect(formatRelativeTime(justNow)).toBe("just now");
  });
});
