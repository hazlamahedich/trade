import { render } from "@testing-library/react";
import { VotePreviewBar } from "@/features/landing/components/VotePreviewBar";

describe("[4.4-UNIT-010] VotePreviewBar", () => {
  it("given bullPct=70 and bearPct=30, when the bar renders, then segments have correct widths", () => {
    const { container } = render(<VotePreviewBar bullPct={70} bearPct={30} />);
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    const segments = bar!.children;
    expect(segments[0]).toHaveStyle({ width: "70%" });
    expect(segments[1]).toHaveStyle({ width: "30%" });
  });

  it("given undecidedPct=30, when the bar renders, then it shows a third segment", () => {
    const { container } = render(<VotePreviewBar bullPct={40} bearPct={30} undecidedPct={30} />);
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children.length).toBe(3);
    expect(bar!.children[2]).toHaveStyle({ width: "30%" });
  });

  it("given bullPct + bearPct = 100, when the bar renders, then it does not show an undecided segment", () => {
    const { container } = render(<VotePreviewBar bullPct={55} bearPct={45} />);
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children.length).toBe(2);
  });

  it("given percentages summing over 100, when the bar renders, then undecided is clamped to 0", () => {
    const { container } = render(<VotePreviewBar bullPct={60} bearPct={50} />);
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children.length).toBe(2);
  });

  it("given bull and bear segments, when the bar renders, then they use emerald and rose color classes", () => {
    const { container } = render(<VotePreviewBar bullPct={50} bearPct={50} />);
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children[0].className).toContain("bg-emerald-500");
    expect(bar!.children[1].className).toContain("bg-rose-500");
  });
});
