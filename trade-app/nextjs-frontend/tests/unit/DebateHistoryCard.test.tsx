import { render, screen } from "@testing-library/react";
import { DebateHistoryCard } from "@/features/debate/components/DebateHistoryCard";
import type { DebateHistoryItem } from "@/features/debate/types/debate-history";

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

const baseDebate: DebateHistoryItem = {
  externalId: "test-123",
  asset: "btc",
  status: "completed",
  guardianVerdict: null,
  guardianInterruptsCount: 0,
  totalVotes: 100,
  voteBreakdown: { bull: 60, bear: 40, undecided: 0 },
  winner: "bull",
  createdAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
};

describe("DebateHistoryCard", () => {
  it("renders asset symbol in uppercase", () => {
    render(<DebateHistoryCard debate={baseDebate} />);
    expect(screen.getByText("BTC")).toBeInTheDocument();
  });

  it("renders bull winner badge with dual-coding (color + icon + text)", () => {
    render(<DebateHistoryCard debate={baseDebate} />);
    expect(screen.getByText("Bull")).toBeInTheDocument();
    expect(screen.getByText("▲")).toBeInTheDocument();
  });

  it("renders bear winner badge with dual-coding", () => {
    render(
      <DebateHistoryCard
        debate={{ ...baseDebate, winner: "bear", voteBreakdown: { bull: 30, bear: 70, undecided: 0 } }}
      />,
    );
    expect(screen.getByText("Bear")).toBeInTheDocument();
    expect(screen.getByText("▼")).toBeInTheDocument();
  });

  it("renders undecided winner badge with dual-coding", () => {
    render(
      <DebateHistoryCard
        debate={{ ...baseDebate, winner: "undecided", voteBreakdown: { bull: 0, bear: 0, undecided: 10 } }}
      />,
    );
    expect(screen.getByText("Undecided")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("renders Unknown fallback badge for unexpected winner values", () => {
    render(
      <DebateHistoryCard
        debate={{ ...baseDebate, winner: "pending" }}
      />,
    );
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders total votes", () => {
    render(<DebateHistoryCard debate={baseDebate} />);
    expect(screen.getByText("100 votes")).toBeInTheDocument();
  });

  it("renders guardian badge when guardianVerdict is present", () => {
    render(
      <DebateHistoryCard
        debate={{ ...baseDebate, guardianVerdict: "Caution" }}
      />,
    );
    expect(screen.getByTitle("Guardian intervened")).toBeInTheDocument();
  });

  it("does not render guardian badge when guardianVerdict is null", () => {
    render(<DebateHistoryCard debate={baseDebate} />);
    expect(screen.queryByTitle("Guardian intervened")).not.toBeInTheDocument();
  });

  it("navigates to debate detail page", () => {
    render(<DebateHistoryCard debate={baseDebate} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/dashboard/debates/test-123");
  });

  it("renders with 0 votes without crashing", () => {
    render(
      <DebateHistoryCard
        debate={{
          ...baseDebate,
          totalVotes: 0,
          voteBreakdown: { bull: 0, bear: 0, undecided: 0 },
        }}
      />,
    );
    expect(screen.getByText("No votes")).toBeInTheDocument();
  });

  it("uses article element with accessible name", () => {
    render(<DebateHistoryCard debate={baseDebate} />);
    expect(screen.getByRole("article", { name: /Debate for BTC/i })).toBeInTheDocument();
  });
});
