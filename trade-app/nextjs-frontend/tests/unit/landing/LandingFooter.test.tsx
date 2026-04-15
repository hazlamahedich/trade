import { render, screen } from "@testing-library/react";
import { LandingFooter } from "@/features/landing/components/LandingFooter";

describe("[4.4-UNIT-006] LandingFooter", () => {
  it("renders the brand name", () => {
    render(<LandingFooter />);
    expect(screen.getByText("AI Trading Debate Lab")).toBeInTheDocument();
  });

  it("renders footer navigation links", () => {
    render(<LandingFooter />);
    expect(screen.getByText("Terms of Service")).toBeInTheDocument();
    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
    expect(screen.getByText("Risk Disclosure")).toBeInTheDocument();
    expect(screen.getByText("Contact")).toBeInTheDocument();
  });

  it("has footer role", () => {
    render(<LandingFooter />);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toBeInTheDocument();
  });
});
