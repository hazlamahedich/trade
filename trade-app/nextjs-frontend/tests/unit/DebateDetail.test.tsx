import { render, screen } from "@testing-library/react";
import { DebateTranscript } from "@/features/debate/components/DebateTranscript";
import { ArchivedBadge } from "@/features/debate/components/ArchivedBadge";
import { generateDebateStructuredData, deriveWinner } from "@/features/debate/utils/structured-data";
import { getWinnerBadge } from "@/features/debate/utils/winner-badge";
import { createMockDebateDetail, createMockTranscriptMessage } from "./factories/debate-detail-factory";

jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return <a href={href}>{children}</a>;
  };
});

describe("generateDebateStructuredData", () => {
  it("[P0] produces correct DiscussionForumPosting schema shape", () => {
    const data = createMockDebateDetail();
    const sd = generateDebateStructuredData(data);

    expect(sd["@context"]).toBe("https://schema.org");
    expect(sd["@type"]).toBe("DiscussionForumPosting");
    expect(sd.headline).toBe("Bull vs Bear on BTC");
    expect(sd.author).toHaveLength(2);
    expect(sd.author[0].name).toBe("Bull Agent");
    expect(sd.interactionStatistic.userInteractionCount).toBe(100);
  });

  it("[P0] uses ISO 8601 dates with timezone", () => {
    const data = createMockDebateDetail({
      createdAt: "2026-04-15T12:00:00.000Z",
      completedAt: "2026-04-15T13:00:00.000Z",
    });
    const sd = generateDebateStructuredData(data);

    expect(sd.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(sd.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("[P0] handles null guardian verdict", () => {
    const data = createMockDebateDetail({ guardianVerdict: null });
    const sd = generateDebateStructuredData(data);
    expect(sd.description).not.toContain("undefined");
    expect(sd.description).not.toContain("null");
  });

  it("[P0] handles bear winner", () => {
    const data = createMockDebateDetail({
      voteBreakdown: { bull: 30, bear: 70, undecided: 0 },
    });
    const winner = deriveWinner(data);
    expect(winner).toBe("bear");
    const sd = generateDebateStructuredData(data);
    expect(sd.description).toContain("Bear");
  });

  it("[P0] handles undecided / tie", () => {
    const data = createMockDebateDetail({
      voteBreakdown: { bull: 50, bear: 50, undecided: 0 },
    });
    const winner = deriveWinner(data);
    expect(winner).toBe("undecided");
  });

  it("[P0] handles zero votes", () => {
    const data = createMockDebateDetail({
      totalVotes: 0,
      voteBreakdown: { bull: 0, bear: 0, undecided: 0 },
    });
    const winner = deriveWinner(data);
    expect(winner).toBe("undecided");
  });

  it("[P0] handles null completedAt — falls back to createdAt", () => {
    const data = createMockDebateDetail({ completedAt: null });
    const sd = generateDebateStructuredData(data);
    expect(sd.dateModified).toBe(new Date(data.createdAt).toISOString());
  });
});

describe("getWinnerBadge (imported from util)", () => {
  it("[P0] returns bull badge", () => {
    const badge = getWinnerBadge("bull");
    expect(badge.label).toBe("Bull");
    expect(badge.icon).toBe("▲");
  });

  it("[P0] returns bear badge", () => {
    const badge = getWinnerBadge("bear");
    expect(badge.label).toBe("Bear");
  });

  it("[P1] handles mixed case", () => {
    const badge = getWinnerBadge("BULL");
    expect(badge.label).toBe("Bull");
  });
});

describe("ArchivedBadge", () => {
  it("[P1] renders Completed Debate text", () => {
    render(<ArchivedBadge />);
    expect(screen.getByText("Completed Debate")).toBeInTheDocument();
  });

  it("[P1] renders with winner context", () => {
    render(<ArchivedBadge winner="bull" />);
    expect(screen.getByText(/Completed Debate — Bull Wins/)).toBeInTheDocument();
  });

  it("[P1] has correct aria-label without winner", () => {
    render(<ArchivedBadge />);
    const badge = screen.getByText("Completed Debate").closest("[aria-label]");
    expect(badge).toHaveAttribute(
      "aria-label",
      "This debate has ended. Final verdict available.",
    );
  });

  it("[P1] has correct aria-label with winner", () => {
    render(<ArchivedBadge winner="bear" />);
    const badge = screen.getByText(/Completed Debate/).closest("[aria-label]");
    expect(badge?.getAttribute("aria-label")).toContain("Bear Wins");
  });
});

describe("DebateTranscript", () => {
  it("[P1] renders messages with role labels", () => {
    const messages = [
      createMockTranscriptMessage("bull", "Rising trend"),
      createMockTranscriptMessage("bear", "Falling trend"),
    ];
    render(<DebateTranscript messages={messages} />);
    expect(screen.getByText("Rising trend")).toBeInTheDocument();
    expect(screen.getByText("Falling trend")).toBeInTheDocument();
    expect(screen.getByText("Bull Agent")).toBeInTheDocument();
    expect(screen.getByText("Bear Agent")).toBeInTheDocument();
  });

  it("[P1] shows not available for null transcript", () => {
    render(<DebateTranscript messages={null} />);
    expect(screen.getByText("Transcript not available")).toBeInTheDocument();
  });

  it("[P1] shows not available for empty array", () => {
    render(<DebateTranscript messages={[]} />);
    expect(screen.getByText("Transcript not available")).toBeInTheDocument();
  });

  it("[P1] shows disclosure for >6 messages", () => {
    const messages = Array.from({ length: 8 }, (_, i) =>
      createMockTranscriptMessage(i % 2 === 0 ? "bull" : "bear", `Message ${i + 1}`),
    );
    render(<DebateTranscript messages={messages} />);
    expect(screen.getByText("Show full transcript (2 more messages)")).toBeInTheDocument();
    expect(screen.getByText("Message 1")).toBeInTheDocument();
  });

  it("[P1] no disclosure for <=6 messages", () => {
    const messages = Array.from({ length: 6 }, (_, i) =>
      createMockTranscriptMessage("bull", `Msg ${i}`),
    );
    render(<DebateTranscript messages={messages} />);
    expect(screen.queryByText(/Show full transcript/)).not.toBeInTheDocument();
  });
});
