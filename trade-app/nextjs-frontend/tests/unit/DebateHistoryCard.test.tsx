import { render, screen } from "@testing-library/react";
import { DebateHistoryCard } from "@/features/debate/components/DebateHistoryCard";
import { createDebateHistoryItem } from "./factories/debate-history-factory";

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

describe("DebateHistoryCard", () => {
  it("[P0] renders asset symbol in uppercase", () => {
    render(<DebateHistoryCard debate={createDebateHistoryItem()} />);
    expect(screen.getByText("BTC")).toBeInTheDocument();
  });

  it("[P0] renders bull winner badge with dual-coding (color + icon + text)", () => {
    render(<DebateHistoryCard debate={createDebateHistoryItem()} />);
    expect(screen.getByText("Bull")).toBeInTheDocument();
    expect(screen.getByText("▲")).toBeInTheDocument();
  });

  it("[P0] renders bear winner badge with dual-coding", () => {
    render(
      <DebateHistoryCard
        debate={createDebateHistoryItem({
          winner: "bear",
          voteBreakdown: { bull: 30, bear: 70, undecided: 0 },
        })}
      />,
    );
    expect(screen.getByText("Bear")).toBeInTheDocument();
    expect(screen.getByText("▼")).toBeInTheDocument();
  });

  it("[P0] renders undecided winner badge with dual-coding", () => {
    render(
      <DebateHistoryCard
        debate={createDebateHistoryItem({
          winner: "undecided",
          voteBreakdown: { bull: 0, bear: 0, undecided: 10 },
        })}
      />,
    );
    expect(screen.getByText("Undecided")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("[P1] renders Unknown fallback badge for unexpected winner values", () => {
    render(
      <DebateHistoryCard
        debate={createDebateHistoryItem({ winner: "pending" })}
      />,
    );
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("[P0] renders total votes", () => {
    render(<DebateHistoryCard debate={createDebateHistoryItem()} />);
    expect(screen.getByText("100 votes")).toBeInTheDocument();
  });

  it("[P1] renders guardian badge when guardianVerdict is present", () => {
    render(
      <DebateHistoryCard
        debate={createDebateHistoryItem({ guardianVerdict: "Caution" })}
      />,
    );
    expect(screen.getByTitle("Guardian intervened")).toBeInTheDocument();
  });

  it("[P1] does not render guardian badge when guardianVerdict is null", () => {
    render(<DebateHistoryCard debate={createDebateHistoryItem()} />);
    expect(screen.queryByTitle("Guardian intervened")).not.toBeInTheDocument();
  });

  it("[P0] navigates to debate detail page", () => {
    render(<DebateHistoryCard debate={createDebateHistoryItem()} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/debates/test-123");
  });

  it("[P0] renders with 0 votes without crashing", () => {
    render(
      <DebateHistoryCard
        debate={createDebateHistoryItem({
          totalVotes: 0,
          voteBreakdown: { bull: 0, bear: 0, undecided: 0 },
        })}
      />,
    );
    expect(screen.getByText("No votes")).toBeInTheDocument();
  });

  it("[P1] uses article element with accessible name", () => {
    render(<DebateHistoryCard debate={createDebateHistoryItem()} />);
    expect(screen.getByRole("article", { name: /Debate for BTC/i })).toBeInTheDocument();
  });

  it("[P1] renders thesisPreview when provided", () => {
    render(
      <DebateHistoryCard
        debate={createDebateHistoryItem()}
        thesisPreview="BTC will reach new highs"
      />,
    );
    expect(
      screen.getByText("BTC will reach new highs"),
    ).toBeInTheDocument();
  });

  it("[P2] does not render thesisPreview section when not provided", () => {
    const { container } = render(<DebateHistoryCard debate={createDebateHistoryItem()} />);
    const lineClamped = container.querySelector(".line-clamp-2");
    expect(lineClamped).not.toBeInTheDocument();
  });

  it("[P1] renders guardian sr-only text when guardianVerdict present", () => {
    render(
      <DebateHistoryCard
        debate={createDebateHistoryItem({ guardianVerdict: "Caution" })}
      />,
    );
    expect(screen.getByText("Guardian: Caution")).toBeInTheDocument();
  });

  it("[P1] handles mixed-case winner values via toLowerCase", () => {
    render(
      <DebateHistoryCard debate={createDebateHistoryItem({ winner: "BULL" })} />,
    );
    expect(screen.getByText("Bull")).toBeInTheDocument();
    expect(screen.getByText("▲")).toBeInTheDocument();
  });

  it("[P1] renders relative time with deterministic fixed dates", () => {
    jest.useFakeTimers({ now: new Date("2026-04-14T12:00:00Z") });
    render(
      <DebateHistoryCard
        debate={createDebateHistoryItem({
          createdAt: "2026-04-14T11:30:00Z",
          completedAt: "2026-04-14T12:00:00Z",
        })}
      />,
    );
    expect(screen.getByText("30m ago")).toBeInTheDocument();
    jest.useRealTimers();
  });
});
