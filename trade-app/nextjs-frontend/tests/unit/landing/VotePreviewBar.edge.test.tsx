import { render } from "@testing-library/react";
import { VotePreviewBar } from "@/features/landing/components/VotePreviewBar";

describe("[4.4-UNIT-010-EDGE] VotePreviewBar edge cases", () => {
  it("given explicit undecidedPct prop, when the bar renders, then it shows a third segment with correct width", () => {
    const { container } = render(
      <VotePreviewBar bullPct={50} bearPct={30} undecidedPct={20} />,
    );
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children.length).toBe(3);
    expect(bar!.children[2]).toHaveStyle({ width: "20%" });
  });

  it("given an undecided segment, when the bar renders, then it uses bg-slate-500", () => {
    const { container } = render(
      <VotePreviewBar bullPct={40} bearPct={40} undecidedPct={20} />,
    );
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children[2].className).toContain("bg-slate-500");
  });

  it("given 0/0 with 100% undecided, when the bar renders, then it shows full-width undecided", () => {
    const { container } = render(
      <VotePreviewBar bullPct={0} bearPct={0} undecidedPct={100} />,
    );
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children.length).toBe(3);
    expect(bar!.children[0]).toHaveStyle({ width: "0%" });
    expect(bar!.children[1]).toHaveStyle({ width: "0%" });
    expect(bar!.children[2]).toHaveStyle({ width: "100%" });
  });

  it("given 100% bull and 0% bear, when the bar renders, then only the bull segment is full", () => {
    const { container } = render(<VotePreviewBar bullPct={100} bearPct={0} />);
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children.length).toBe(2);
    expect(bar!.children[0]).toHaveStyle({ width: "100%" });
    expect(bar!.children[1]).toHaveStyle({ width: "0%" });
  });

  it("given 0% bull and 100% bear, when the bar renders, then only the bear segment is full", () => {
    const { container } = render(<VotePreviewBar bullPct={0} bearPct={100} />);
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children.length).toBe(2);
    expect(bar!.children[1]).toHaveStyle({ width: "100%" });
  });

  it("given any bar, when rendered, then segments use transition-all for animation", () => {
    const { container } = render(<VotePreviewBar bullPct={50} bearPct={50} />);
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children[0].className).toContain("transition-all");
    expect(bar!.children[1].className).toContain("transition-all");
  });

  it("given any bar, when rendered, then the container has rounded-full and bg-slate-700", () => {
    const { container } = render(<VotePreviewBar bullPct={50} bearPct={50} />);
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.className).toContain("rounded-full");
    expect(bar!.className).toContain("bg-slate-700");
  });
});
