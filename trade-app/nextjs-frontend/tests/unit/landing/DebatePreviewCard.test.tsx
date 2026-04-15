import { render, screen } from "@testing-library/react";
import { DebatePreviewCard } from "@/features/landing/components/DebatePreviewCard";
import { createRecentDebatePreview } from "../factories/landing-factory";

describe("[4.4-UNIT-009] DebatePreviewCard", () => {
  it("given a debate with lowercase asset, when the card renders, then it shows the asset in uppercase", () => {
    const debate = createRecentDebatePreview({ asset: "eth" });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.getByText("ETH")).toBeInTheDocument();
  });

  it("given a debate with bull winner, when the card renders, then it shows 'Bull wins' label", () => {
    const debate = createRecentDebatePreview({ winner: "bull" });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.getByText("Bull wins")).toBeInTheDocument();
  });

  it("given a debate with bear winner, when the card renders, then it shows 'Bear wins' label", () => {
    const debate = createRecentDebatePreview({ winner: "bear" });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.getByText("Bear wins")).toBeInTheDocument();
  });

  it("given a debate with draw winner, when the card renders, then it shows 'Undecided' label", () => {
    const debate = createRecentDebatePreview({ winner: "draw" });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.getByText("Undecided")).toBeInTheDocument();
  });

  it("given a debate with externalId, when the card renders, then it links to the debate detail page", () => {
    const debate = createRecentDebatePreview({ externalId: "deb_xy" });
    render(<DebatePreviewCard debate={debate} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/debates/deb_xy");
  });

  it("given a debate with vote breakdown, when the card renders, then it shows percentage text", () => {
    const debate = createRecentDebatePreview({
      totalVotes: 100,
      voteBreakdown: { bull: 60, bear: 40, undecided: 0 },
    });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.getByText(/60% Bull/)).toBeInTheDocument();
    expect(screen.getByText(/40% Bear/)).toBeInTheDocument();
  });

  it("given a debate with totalVotes, when the card renders, then it shows the vote count", () => {
    const debate = createRecentDebatePreview({ totalVotes: 250 });
    render(<DebatePreviewCard debate={debate} />);
    expect(screen.getByText("250 votes")).toBeInTheDocument();
  });

  it("given a debate card, when rendered, then it has border-white/15 for design system compliance", () => {
    const debate = createRecentDebatePreview();
    const { container } = render(<DebatePreviewCard debate={debate} />);
    const card = container.querySelector("[data-testid='debate-preview-card']");
    expect(card!.className).toContain("border-white/15");
  });
});
