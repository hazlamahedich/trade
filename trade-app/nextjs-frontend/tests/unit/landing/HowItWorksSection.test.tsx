import { render, screen } from "@testing-library/react";
import { HowItWorksSection } from "@/features/landing/components/HowItWorksSection";

describe("[4.4-UNIT-002] HowItWorksSection", () => {
  it("given the HowItWorks section, when rendered, then it shows the section heading as h2", () => {
    render(<HowItWorksSection />);
    expect(
      screen.getByRole("heading", { level: 2, name: /how it works/i }),
    ).toBeInTheDocument();
  });

  it("given the HowItWorks section, when rendered, then it shows the three steps (Bull, Bear, You)", () => {
    render(<HowItWorksSection />);
    expect(screen.getByText("Bull Argues")).toBeInTheDocument();
    expect(screen.getByText("Bear Counters")).toBeInTheDocument();
    expect(screen.getByText("You Decide")).toBeInTheDocument();
  });

  it("given the HowItWorks section, when rendered, then it has an accessible section via aria-labelledby", () => {
    render(<HowItWorksSection />);
    const section = screen.getByRole("heading", { level: 2 }).closest("section");
    expect(section).toHaveAttribute("aria-labelledby", "how-it-works-heading");
  });
});
