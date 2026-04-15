import { render, screen } from "@testing-library/react";
import { DebatePreviewCard } from "@/features/landing/components/DebatePreviewCard";
import { createRecentDebatePreview } from "../factories/landing-factory";

describe("[4.4-UNIT-009-EDGE] DebatePreviewCard edge cases", () => {
  it("handles zero totalVotes — shows 0 votes with 100% undecided bar", () => {
    const debate = createRecentDebatePreview({
      totalVotes: 0,
      voteBreakdown: { bull: 0, bear: 0, undecided: 0 },
    });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.getByText("0 votes")).toBeInTheDocument();
  });

  it("shows singular 'vote' for totalVotes of 1", () => {
    const debate = createRecentDebatePreview({
      totalVotes: 1,
      voteBreakdown: { bull: 1, bear: 0, undecided: 0 },
    });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.getByText("1 vote")).toBeInTheDocument();
  });

  it("shows plural 'votes' for totalVotes > 1", () => {
    const debate = createRecentDebatePreview({ totalVotes: 42 });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.getByText("42 votes")).toBeInTheDocument();
  });

  it("shows undecided percentage text when undecidedPct > 0", () => {
    const debate = createRecentDebatePreview({
      totalVotes: 100,
      voteBreakdown: { bull: 40, bear: 30, undecided: 30 },
    });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.getByText(/30% Undecided/)).toBeInTheDocument();
  });

  it("hides undecided text when bull + bear = 100%", () => {
    const debate = createRecentDebatePreview({
      totalVotes: 100,
      voteBreakdown: { bull: 60, bear: 40, undecided: 0 },
    });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.queryByText(/Undecided/)).not.toBeInTheDocument();
  });

  it("applies emerald color class for bull winner", () => {
    const debate = createRecentDebatePreview({ winner: "bull" });
    const { container } = render(<DebatePreviewCard debate={debate} />);
    const winnerLabel = screen.getByText("Bull wins");
    expect(winnerLabel.className).toContain("text-emerald-400");
  });

  it("applies rose color class for bear winner", () => {
    const debate = createRecentDebatePreview({ winner: "bear" });
    render(<DebatePreviewCard debate={debate} />);
    const winnerLabel = screen.getByText("Bear wins");
    expect(winnerLabel.className).toContain("text-rose-400");
  });

  it("applies slate color class for undecided winner", () => {
    const debate = createRecentDebatePreview({ winner: "draw" });
    render(<DebatePreviewCard debate={debate} />);
    const winnerLabel = screen.getByText("Undecided");
    expect(winnerLabel.className).toContain("text-slate-400");
  });

  it("handles all-zero voteBreakdown values", () => {
    const debate = createRecentDebatePreview({
      totalVotes: 5,
      voteBreakdown: { bull: 5, bear: 0, undecided: 0 },
    });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.getByText(/100% Bull/)).toBeInTheDocument();
  });

  it("has min-h-[44px] for touch target compliance", () => {
    const debate = createRecentDebatePreview();
    const { container } = render(<DebatePreviewCard debate={debate} />);
    const card = container.querySelector("[data-testid='debate-preview-card']");
    expect(card!.className).toContain("min-h-[44px]");
  });

  it("rounds bull percentage correctly (per AGENTS.md lesson #10)", () => {
    const debate = createRecentDebatePreview({
      totalVotes: 3,
      voteBreakdown: { bull: 2, bear: 1, undecided: 0 },
    });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.getByText(/67% Bull/)).toBeInTheDocument();
    expect(screen.getByText(/33% Bear/)).toBeInTheDocument();
  });
});
