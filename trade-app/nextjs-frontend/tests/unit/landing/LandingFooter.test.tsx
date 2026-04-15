import { render, screen } from "@testing-library/react";
import { LandingFooter } from "@/features/landing/components/LandingFooter";

describe("[4.4-UNIT-006] LandingFooter", () => {
  it("given the LandingFooter, when rendered, then it shows the brand name", () => {
    render(<LandingFooter />);
    expect(screen.getByText("AI Trading Debate Lab")).toBeInTheDocument();
  });

  it("given the LandingFooter, when rendered, then it shows all navigation links", () => {
    render(<LandingFooter />);
    expect(screen.getByText("Terms of Service")).toBeInTheDocument();
    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
    expect(screen.getByText("Risk Disclosure")).toBeInTheDocument();
    expect(screen.getByText("Contact")).toBeInTheDocument();
  });

  it("given the LandingFooter, when rendered, then it has contentinfo role", () => {
    render(<LandingFooter />);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toBeInTheDocument();
  });
});
