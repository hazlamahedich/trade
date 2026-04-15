import { generateDebateStructuredData, deriveWinner } from "@/features/debate/utils/structured-data";
import { getWinnerBadge } from "@/features/debate/utils/winner-badge";
import { createMockDebateDetail } from "./factories/debate-detail-factory";

describe("generateDebateStructuredData", () => {
  it("[P0][4.3-018] given valid debate data, produces DiscussionForumPosting schema", () => {
    const data = createMockDebateDetail();
    const sd = generateDebateStructuredData(data);

    expect(sd["@context"]).toBe("https://schema.org");
    expect(sd["@type"]).toBe("DiscussionForumPosting");
    expect(sd.headline).toBe("Bull vs Bear on BTC");
    expect(sd.author).toHaveLength(2);
    expect(sd.author[0].name).toBe("Bull Agent");
    expect(sd.interactionStatistic.userInteractionCount).toBe(100);
  });

  it("[P0][4.3-019] given dates with timezone, produces ISO 8601 format", () => {
    const data = createMockDebateDetail({
      createdAt: "2026-04-15T12:00:00.000Z",
      completedAt: "2026-04-15T13:00:00.000Z",
    });
    const sd = generateDebateStructuredData(data);

    expect(sd.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(sd.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("[P0][4.3-020] given null guardian verdict, produces description without undefined", () => {
    const data = createMockDebateDetail({ guardianVerdict: null });
    const sd = generateDebateStructuredData(data);
    expect(sd.description).not.toContain("undefined");
    expect(sd.description).not.toContain("null");
  });

  it("[P0][4.3-021] given bear-majority votes, derives bear as winner", () => {
    const data = createMockDebateDetail({
      voteBreakdown: { bull: 30, bear: 70, undecided: 0 },
    });
    const winner = deriveWinner(data);
    expect(winner).toBe("bear");
    const sd = generateDebateStructuredData(data);
    expect(sd.description).toContain("Bear");
  });

  it("[P0][4.3-022] given tied votes, derives undecided winner", () => {
    const data = createMockDebateDetail({
      voteBreakdown: { bull: 50, bear: 50, undecided: 0 },
    });
    const winner = deriveWinner(data);
    expect(winner).toBe("undecided");
  });

  it("[P0][4.3-023] given zero total votes, derives undecided winner", () => {
    const data = createMockDebateDetail({
      totalVotes: 0,
      voteBreakdown: { bull: 0, bear: 0, undecided: 0 },
    });
    const winner = deriveWinner(data);
    expect(winner).toBe("undecided");
  });

  it("[P0][4.3-024] given null completedAt, falls back to createdAt for dateModified", () => {
    const data = createMockDebateDetail({ completedAt: null });
    const sd = generateDebateStructuredData(data);
    expect(sd.dateModified).toBe(new Date(data.createdAt).toISOString());
  });

  it("[P1][4.3-025] given invalid date string, handles safely without throwing", () => {
    const data = createMockDebateDetail({ createdAt: "not-a-date" });
    const sd = generateDebateStructuredData(data);
    expect(sd.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("[P1][4.3-026] given null guardian verdict, produces clean description with asset name", () => {
    const data = createMockDebateDetail({ guardianVerdict: null });
    const sd = generateDebateStructuredData(data);
    expect(sd.description).not.toContain("undefined");
    expect(sd.description).not.toContain("null");
    expect(sd.description).toContain("AI debate analysis on BTC");
  });

  it("[P2][4.3-027] given valid debate, produces interactionStatistic with LikeAction type", () => {
    const data = createMockDebateDetail();
    const sd = generateDebateStructuredData(data);
    expect(sd.interactionStatistic.interactionType).toBe(
      "https://schema.org/LikeAction",
    );
    expect(sd.interactionStatistic["@type"]).toBe("InteractionCounter");
  });

  it("[P2][4.3-028] given valid debate, produces authors with disambiguatingDescription", () => {
    const data = createMockDebateDetail();
    const sd = generateDebateStructuredData(data);
    expect(sd.author[0].disambiguatingDescription).toBe(
      "AI trading analysis agent",
    );
    expect(sd.author[1].disambiguatingDescription).toBe(
      "AI trading analysis agent",
    );
  });
});

describe("getWinnerBadge (imported from util)", () => {
  it("[P0][4.3-029] given 'bull' winner, returns bull badge with icon", () => {
    const badge = getWinnerBadge("bull");
    expect(badge.label).toBe("Bull");
    expect(badge.icon).toBe("▲");
  });

  it("[P0][4.3-030] given 'bear' winner, returns bear badge", () => {
    const badge = getWinnerBadge("bear");
    expect(badge.label).toBe("Bear");
  });

  it("[P1][4.3-031] given mixed-case 'BULL', normalizes to bull badge", () => {
    const badge = getWinnerBadge("BULL");
    expect(badge.label).toBe("Bull");
  });

  it("[P1][4.3-032] given 'undecided' winner, returns undecided badge with question icon", () => {
    const badge = getWinnerBadge("undecided");
    expect(badge.label).toBe("Undecided");
    expect(badge.icon).toBe("?");
  });

  it("[P2][4.3-033] given unrecognized winner value, returns unknown badge with dash icon", () => {
    const badge = getWinnerBadge("invalid_value");
    expect(badge.label).toBe("Unknown");
    expect(badge.icon).toBe("—");
  });
});
