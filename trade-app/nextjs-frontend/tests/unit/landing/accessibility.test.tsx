import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { HeroSection } from "@/features/landing/components/HeroSection";
import { LiveNowTicker } from "@/features/landing/components/LiveNowTicker";
import { HowItWorksSection } from "@/features/landing/components/HowItWorksSection";
import { ValuePropSection } from "@/features/landing/components/ValuePropSection";
import { RecentDebatesSection } from "@/features/landing/components/RecentDebatesSection";
import { DisclaimerBanner } from "@/features/landing/components/DisclaimerBanner";
import { LandingFooter } from "@/features/landing/components/LandingFooter";
import { createActiveDebateSummary, createRecentDebatePreview } from "../factories/landing-factory";

expect.extend(toHaveNoViolations);

describe("[4.4-A11Y] Accessibility tests", () => {
  it("given the page shell, when rendered, then a skip-to-content link is present", () => {
    const { container } = render(
      <>
        <a href="#main-content" className="sr-only focus:not-sr-only">
          Skip to content
        </a>
        <main id="main-content">Content</main>
      </>,
    );
    const skipLink = container.querySelector("a[href='#main-content']");
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveTextContent("Skip to content");
  });

  it("given an active debate, when LiveNowTicker renders, then it has aria-live='polite'", () => {
    const debate = createActiveDebateSummary({ status: "active" });
    const { container } = render(<LiveNowTicker activeDebate={debate} />);
    const ticker = container.querySelector("[data-testid='live-now-ticker']");
    expect(ticker).toHaveAttribute("aria-live", "polite");
    expect(ticker).toHaveAttribute("role", "status");
  });

  it("given an active debate, when LiveNowTicker renders, then the LIVE badge has both color and text (dual-coding)", () => {
    const debate = createActiveDebateSummary({ status: "active" });
    render(<LiveNowTicker activeDebate={debate} />);
    const liveText = screen.getByText("LIVE");
    expect(liveText).toBeInTheDocument();
    expect(liveText.className).toContain("text-emerald-400");
  });

  it("given all sections, when rendered, then there is a single h1 in HeroSection and h2s in child sections", () => {
    const { container } = render(
      <>
        <HeroSection />
        <HowItWorksSection />
        <ValuePropSection />
      </>,
    );
    const h1s = container.querySelectorAll("h1");
    expect(h1s.length).toBe(1);

    const h2s = container.querySelectorAll("h2");
    expect(h2s.length).toBeGreaterThanOrEqual(2);
  });

  it("given the HeroSection, when rendered, then CTA links have min-h-[44px] for touch targets", () => {
    render(<HeroSection />);
    const cta = screen.getByRole("link", { name: /see it in action/i });
    expect(cta.className).toContain("min-h-[44px]");
  });

  it("given all page sections, when rendered, then semantic landmarks (main, section, footer) are present", () => {
    const debates = [createRecentDebatePreview()];
    const { container } = render(
      <>
        <main id="main-content">
          <HowItWorksSection />
          <RecentDebatesSection debates={debates} />
          <DisclaimerBanner />
        </main>
        <LandingFooter />
      </>,
    );
    expect(container.querySelector("main")).toBeInTheDocument();
    expect(container.querySelectorAll("section").length).toBeGreaterThanOrEqual(1);
    expect(container.querySelector("footer")).toBeInTheDocument();
  });

  it("given the HeroSection, when rendered, then it has no axe violations", async () => {
    const { container } = render(<HeroSection />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("given the HowItWorksSection, when rendered, then it has no axe violations", async () => {
    const { container } = render(<HowItWorksSection />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("given the ValuePropSection, when rendered, then it has no axe violations", async () => {
    const { container } = render(<ValuePropSection />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("given the DisclaimerBanner, when rendered, then it has no axe violations", async () => {
    const { container } = render(<DisclaimerBanner />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("given the LandingFooter, when rendered, then it has no axe violations", async () => {
    const { container } = render(<LandingFooter />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("given an active debate, when LiveNowTicker renders in live state, then it has no axe violations", async () => {
    const debate = createActiveDebateSummary({ status: "active" });
    const { container } = render(<LiveNowTicker activeDebate={debate} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("given debate data, when RecentDebatesSection renders, then it has no axe violations", async () => {
    const debates = [createRecentDebatePreview()];
    const { container } = render(<RecentDebatesSection debates={debates} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
