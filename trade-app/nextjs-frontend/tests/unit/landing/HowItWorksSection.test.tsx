import { render, screen } from "@testing-library/react";
import { HowItWorksSection } from "@/features/landing/components/HowItWorksSection";

describe("[4.4-UNIT-002] HowItWorksSection", () => {
  it("renders the section heading", () => {
    render(<HowItWorksSection />);
    expect(
      screen.getByRole("heading", { level: 2, name: /how it works/i }),
    ).toBeInTheDocument();
  });

  it("renders the three steps", () => {
    render(<HowItWorksSection />);
    expect(screen.getByText("Bull Argues")).toBeInTheDocument();
    expect(screen.getByText("Bear Counters")).toBeInTheDocument();
    expect(screen.getByText("You Decide")).toBeInTheDocument();
  });

  it("has accessible heading via aria-labelledby", () => {
    render(<HowItWorksSection />);
    const section = screen.getByRole("heading", { level: 2 }).closest("section");
    expect(section).toHaveAttribute("aria-labelledby", "how-it-works-heading");
  });
});
