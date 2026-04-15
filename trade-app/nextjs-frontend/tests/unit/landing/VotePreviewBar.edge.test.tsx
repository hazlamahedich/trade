import { render } from "@testing-library/react";
import { VotePreviewBar } from "@/features/landing/components/VotePreviewBar";

describe("[4.4-UNIT-010-EDGE] VotePreviewBar edge cases", () => {
  it("renders undecided segment via explicit undecidedPct prop", () => {
    const { container } = render(
      <VotePreviewBar bullPct={50} bearPct={30} undecidedPct={20} />,
    );
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children.length).toBe(3);
    expect(bar!.children[2]).toHaveStyle({ width: "20%" });
  });

  it("applies bg-slate-500 to undecided segment", () => {
    const { container } = render(
      <VotePreviewBar bullPct={40} bearPct={40} undecidedPct={20} />,
    );
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children[2].className).toContain("bg-slate-500");
  });

  it("handles 0/0 split with undecided at 100", () => {
    const { container } = render(
      <VotePreviewBar bullPct={0} bearPct={0} undecidedPct={100} />,
    );
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children.length).toBe(3);
    expect(bar!.children[0]).toHaveStyle({ width: "0%" });
    expect(bar!.children[1]).toHaveStyle({ width: "0%" });
    expect(bar!.children[2]).toHaveStyle({ width: "100%" });
  });

  it("renders only bull segment at 100%", () => {
    const { container } = render(<VotePreviewBar bullPct={100} bearPct={0} />);
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children.length).toBe(2);
    expect(bar!.children[0]).toHaveStyle({ width: "100%" });
    expect(bar!.children[1]).toHaveStyle({ width: "0%" });
  });

  it("renders only bear segment at 100%", () => {
    const { container } = render(<VotePreviewBar bullPct={0} bearPct={100} />);
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children.length).toBe(2);
    expect(bar!.children[1]).toHaveStyle({ width: "100%" });
  });

  it("uses transition-all class for animation", () => {
    const { container } = render(<VotePreviewBar bullPct={50} bearPct={50} />);
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.children[0].className).toContain("transition-all");
    expect(bar!.children[1].className).toContain("transition-all");
  });

  it("has rounded-full and bg-slate-700 on container", () => {
    const { container } = render(<VotePreviewBar bullPct={50} bearPct={50} />);
    const bar = container.querySelector("[data-testid='vote-preview-bar']");
    expect(bar!.className).toContain("rounded-full");
    expect(bar!.className).toContain("bg-slate-700");
  });
});
