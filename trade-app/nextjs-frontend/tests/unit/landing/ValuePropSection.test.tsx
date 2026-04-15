import { render, screen } from "@testing-library/react";
import { ValuePropSection } from "@/features/landing/components/ValuePropSection";

describe("[4.4-UNIT-003] ValuePropSection", () => {
  it("renders the value prop headline", () => {
    render(<ValuePropSection />);
    expect(
      screen.getByRole("heading", { level: 2 }),
    ).toHaveTextContent("Stop Second-Guessing. Watch the Debate.");
  });

  it("renders the subtext mentioning Bull, Bear, and Guardian", () => {
    render(<ValuePropSection />);
    expect(screen.getByText(/Bull makes the case/)).toBeInTheDocument();
    expect(screen.getByText(/You get clarity/)).toBeInTheDocument();
  });

  it("renders the flow diagram steps", () => {
    render(<ValuePropSection />);
    expect(screen.getByText("Raw Data")).toBeInTheDocument();
    expect(screen.getByText("You Get Clarity")).toBeInTheDocument();
  });
});
