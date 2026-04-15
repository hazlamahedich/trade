import { render } from "@testing-library/react";
import { VotePreviewBar } from "@/features/landing/components/VotePreviewBar";

describe("[4.4-UNIT-010] VotePreviewBar", () => {
  it("renders bull and bear segments with correct widths", () => {
    const { container } = render(<VotePreviewBar bullPct={70} bearPct={30} />);
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    const segments = bar!.children;
    expect(segments[0]).toHaveStyle({ width: "70%" });
    expect(segments[1]).toHaveStyle({ width: "30%" });
  });

  it("renders undecided segment when bullPct + bearPct < 100", () => {
    const { container } = render(<VotePreviewBar bullPct={40} bearPct={30} />);
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children.length).toBe(3);
    expect(bar!.children[2]).toHaveStyle({ width: "30%" });
  });

  it("does not render undecided segment when bullPct + bearPct = 100", () => {
    const { container } = render(<VotePreviewBar bullPct={55} bearPct={45} />);
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children.length).toBe(2);
  });

  it("clamps undecided to 0 if percentages sum exceeds 100", () => {
    const { container } = render(<VotePreviewBar bullPct={60} bearPct={50} />);
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children.length).toBe(2);
  });

  it("applies correct color classes", () => {
    const { container } = render(<VotePreviewBar bullPct={50} bearPct={50} />);
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children[0].className).toContain("bg-emerald-500");
    expect(bar!.children[1].className).toContain("bg-rose-500");
  });
});
