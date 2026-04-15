import { render, screen } from "@testing-library/react";
import { HeroSection } from "@/features/landing/components/HeroSection";

describe("[4.4-UNIT-001] HeroSection", () => {
  it("renders the hero headline", () => {
    render(<HeroSection />);
    expect(
      screen.getByRole("heading", { level: 1 }),
    ).toHaveTextContent("Watch AI Agents Debate Your Next Trade");
  });

  it("renders the soft CTA link", () => {
    render(<HeroSection />);
    const cta = screen.getByRole("link", { name: /see it in action/i });
    expect(cta).toHaveAttribute("href", "/debates");
  });

  it("renders the cognitive offloading tagline", () => {
    render(<HeroSection />);
    expect(screen.getByText(/Cognitive Offloading/)).toBeInTheDocument();
  });

  it("has fade-in animation classes on glow elements", () => {
    const { container } = render(<HeroSection />);
    const fadeIns = container.querySelectorAll(".animate-fade-in");
    expect(fadeIns.length).toBeGreaterThan(0);
  });
});
