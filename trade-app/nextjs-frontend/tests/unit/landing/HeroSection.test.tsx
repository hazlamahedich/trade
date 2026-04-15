import { render, screen } from "@testing-library/react";
import { HeroSection } from "@/features/landing/components/HeroSection";

describe("[4.4-UNIT-001] HeroSection", () => {
  it("given the hero section, when rendered, then it shows the headline as h1", () => {
    render(<HeroSection />);
    expect(
      screen.getByRole("heading", { level: 1 }),
    ).toHaveTextContent("Watch AI Agents Debate Your Next Trade");
  });

  it("given the hero section, when rendered, then it shows a soft CTA linking to /debates", () => {
    render(<HeroSection />);
    const cta = screen.getByRole("link", { name: /see it in action/i });
    expect(cta).toHaveAttribute("href", "/debates");
  });

  it("given the hero section, when rendered, then it displays the Cognitive Offloading tagline", () => {
    render(<HeroSection />);
    expect(screen.getByText(/Cognitive Offloading/)).toBeInTheDocument();
  });

  it("given the hero section, when rendered, then glow elements have fade-in animation classes", () => {
    const { container } = render(<HeroSection />);
    const fadeIns = container.querySelectorAll(".animate-fade-in");
    expect(fadeIns.length).toBeGreaterThan(0);
  });
});
