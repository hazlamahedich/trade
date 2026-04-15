import { render, screen } from "@testing-library/react";
import { ValuePropSection } from "@/features/landing/components/ValuePropSection";

describe("[4.4-UNIT-003] ValuePropSection", () => {
  it("given the ValueProp section, when rendered, then it shows the headline as h2", () => {
    render(<ValuePropSection />);
    expect(
      screen.getByRole("heading", { level: 2 }),
    ).toHaveTextContent("Stop Second-Guessing. Watch the Debate.");
  });

  it("given the ValueProp section, when rendered, then it mentions Bull, Bear, Guardian and clarity", () => {
    render(<ValuePropSection />);
    expect(screen.getByText(/Bull makes the case/)).toBeInTheDocument();
    expect(screen.getByText(/You get clarity/)).toBeInTheDocument();
  });

  it("given the ValueProp section, when rendered, then it shows the flow diagram steps", () => {
    render(<ValuePropSection />);
    expect(screen.getByText("Raw Data")).toBeInTheDocument();
    expect(screen.getByText("You Get Clarity")).toBeInTheDocument();
  });
});
