import { render, screen } from "@testing-library/react";
import { DisclaimerBanner } from "@/features/landing/components/DisclaimerBanner";

describe("[4.4-UNIT-005] DisclaimerBanner", () => {
  it("given the DisclaimerBanner, when rendered, then it shows the summary disclaimer text", () => {
    render(<DisclaimerBanner />);
    expect(screen.getByText(/Trading involves risk/)).toBeInTheDocument();
    expect(screen.getByText(/not financial advice/)).toBeInTheDocument();
  });

  it("given the DisclaimerBanner, when rendered, then the disclaimer is inside expandable <details>", () => {
    render(<DisclaimerBanner />);
    const details = screen.getByText(/Trading involves risk/).closest("details");
    expect(details).toBeInTheDocument();
  });

  it("given the DisclaimerBanner, when rendered, then it has min-h-[5vh] for viewport height requirement", () => {
    const { container } = render(<DisclaimerBanner />);
    const section = container.querySelector("section");
    expect(section?.className).toContain("min-h-[5vh]");
  });

  it("given the DisclaimerBanner, when expanded, then it contains the full disclaimer text", () => {
    render(<DisclaimerBanner />);
    expect(
      screen.getByText(/AI Trading Debate Lab is an educational/),
    ).toBeInTheDocument();
  });
});
