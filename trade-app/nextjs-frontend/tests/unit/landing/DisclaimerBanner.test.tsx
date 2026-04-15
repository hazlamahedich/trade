import { render, screen } from "@testing-library/react";
import { DisclaimerBanner } from "@/features/landing/components/DisclaimerBanner";

describe("[4.4-UNIT-005] DisclaimerBanner", () => {
  it("renders the summary disclaimer text", () => {
    render(<DisclaimerBanner />);
    expect(screen.getByText(/Trading involves risk/)).toBeInTheDocument();
    expect(screen.getByText(/not financial advice/)).toBeInTheDocument();
  });

  it("has the disclaimer details expandable", () => {
    render(<DisclaimerBanner />);
    const details = screen.getByText(/Trading involves risk/).closest("details");
    expect(details).toBeInTheDocument();
  });

  it("has min-h-[5vh] class for viewport height requirement", () => {
    const { container } = render(<DisclaimerBanner />);
    const section = container.querySelector("section");
    expect(section?.className).toContain("min-h-[5vh]");
  });

  it("contains the full disclaimer expanded text", () => {
    render(<DisclaimerBanner />);
    expect(
      screen.getByText(/AI Trading Debate Lab is an educational/),
    ).toBeInTheDocument();
  });
});
