import { render, screen } from "@testing-library/react";
import { DebatePreviewCard } from "@/features/landing/components/DebatePreviewCard";
import { createRecentDebatePreview } from "../factories/landing-factory";

describe("[4.4-UNIT-009-EDGE] DebatePreviewCard edge cases", () => {
  it("given zero totalVotes, when the card renders, then it shows '0 votes'", () => {
    const debate = createRecentDebatePreview({
      totalVotes: 0,
      voteBreakdown: { bull: 0, bear: 0, undecided: 0 },
    });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.getByText("0 votes")).toBeInTheDocument();
  });

  it("given 1 totalVote, when the card renders, then it uses singular 'vote'", () => {
    const debate = createRecentDebatePreview({
      totalVotes: 1,
      voteBreakdown: { bull: 1, bear: 0, undecided: 0 },
    });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.getByText("1 vote")).toBeInTheDocument();
  });

  it("given totalVotes > 1, when the card renders, then it uses plural 'votes'", () => {
    const debate = createRecentDebatePreview({ totalVotes: 42 });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.getByText("42 votes")).toBeInTheDocument();
  });

  it("given votes with undecided > 0, when the card renders, then it shows undecided percentage", () => {
    const debate = createRecentDebatePreview({
      totalVotes: 100,
      voteBreakdown: { bull: 40, bear: 30, undecided: 30 },
    });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.getByText(/30% Undecided/)).toBeInTheDocument();
  });

  it("given bull + bear = 100%, when the card renders, then it hides undecided text", () => {
    const debate = createRecentDebatePreview({
      totalVotes: 100,
      voteBreakdown: { bull: 60, bear: 40, undecided: 0 },
    });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.queryByText(/Undecided/)).not.toBeInTheDocument();
  });

  it("given a bull winner, when the card renders, then the label uses emerald color", () => {
    const debate = createRecentDebatePreview({ winner: "bull" });
    const { container } = render(<DebatePreviewCard debate={debate} />);
    const winnerLabel = screen.getByText("Bull wins");
    expect(winnerLabel.className).toContain("text-emerald-400");
  });

  it("given a bear winner, when the card renders, then the label uses rose color", () => {
    const debate = createRecentDebatePreview({ winner: "bear" });
    render(<DebatePreviewCard debate={debate} />);
    const winnerLabel = screen.getByText("Bear wins");
    expect(winnerLabel.className).toContain("text-rose-400");
  });

  it("given a draw winner, when the card renders, then the label uses slate color", () => {
    const debate = createRecentDebatePreview({ winner: "draw" });
    render(<DebatePreviewCard debate={debate} />);
    const winnerLabel = screen.getByText("Undecided");
    expect(winnerLabel.className).toContain("text-slate-400");
  });

  it("given all votes for one side, when the card renders, then it shows 100% for that side", () => {
    const debate = createRecentDebatePreview({
      totalVotes: 5,
      voteBreakdown: { bull: 5, bear: 0, undecided: 0 },
    });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.getByText(/100% Bull/)).toBeInTheDocument();
  });

  it("given any debate card, when rendered, then it has min-h-[44px] for touch target compliance", () => {
    const debate = createRecentDebatePreview();
    const { container } = render(<DebatePreviewCard debate={debate} />);
    const card = container.querySelector("[data-testid='debate-preview-card']");
    expect(card!.className).toContain("min-h-[44px]");
  });

  it("given non-round percentages (2/3 split), when the card renders, then bull rounds correctly per AGENTS.md lesson #10", () => {
    const debate = createRecentDebatePreview({
      totalVotes: 3,
      voteBreakdown: { bull: 2, bear: 1, undecided: 0 },
    });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.getByText(/67% Bull/)).toBeInTheDocument();
    expect(screen.getByText(/33% Bear/)).toBeInTheDocument();
  });
});
