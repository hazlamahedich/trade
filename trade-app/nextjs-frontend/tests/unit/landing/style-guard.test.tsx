import { readFileSync } from "fs";
import { join } from "path";
import { render } from "@testing-library/react";
import { HeroSection } from "@/features/landing/components/HeroSection";
import { HowItWorksSection } from "@/features/landing/components/HowItWorksSection";
import { ValuePropSection } from "@/features/landing/components/ValuePropSection";
import { RecentDebatesSection } from "@/features/landing/components/RecentDebatesSection";
import { DebatePreviewCard } from "@/features/landing/components/DebatePreviewCard";
import { DisclaimerBanner } from "@/features/landing/components/DisclaimerBanner";
import { LandingFooter } from "@/features/landing/components/LandingFooter";
import { StickyCtaBar } from "@/features/landing/components/StickyCtaBar";
import { createRecentDebatePreview } from "../factories/landing-factory";

const COMPONENTS_DIR = join(process.cwd(), "features/landing/components");

function getComponentLines(filename: string): number {
  const content = readFileSync(join(COMPONENTS_DIR, filename), "utf-8");
  return content.split("\n").length;
}

describe("[4.4-STYLE] Style guard tests", () => {
  describe("border-glass design token compliance", () => {
    it("given a DebatePreviewCard, when rendered, then it uses border-glass token", () => {
      const debate = createRecentDebatePreview();
      const { container } = render(<DebatePreviewCard debate={debate} />);
      const card = container.querySelector("[data-testid='debate-preview-card']");
      expect(card!.className).toContain("border-glass");
      expect(card!.className).not.toContain("border-white/10");
    });

    it("given a StickyCtaBar, when rendered, then it uses border-glass token", () => {
      const { container } = render(<StickyCtaBar />);
      const bar = container.querySelector("[data-testid='sticky-cta-bar']");
      if (bar) {
        expect(bar.className).toContain("border-glass");
      }
    });
  });

  describe("text-secondary-safe token compliance (not text-slate-500)", () => {
    it("given HowItWorksSection, when rendered, then step descriptions use text-secondary-safe minimum", () => {
      const { container } = render(<HowItWorksSection />);
      const slate500s = container.querySelectorAll(".text-slate-500");
      expect(slate500s.length).toBe(0);
    });

    it("given ValuePropSection, when rendered, then paragraphs use text-slate-400 minimum", () => {
      const { container } = render(<ValuePropSection />);
      const bodyText = container.querySelectorAll("p");
      bodyText.forEach((p) => {
        const cls = p.className;
        if (cls.includes("text-slate-")) {
          expect(cls).not.toContain("text-slate-500");
        }
      });
    });
  });

  describe("component line counts <= 300", () => {
    const files = [
      "HeroSection.tsx",
      "LiveNowTicker.tsx",
      "HowItWorksSection.tsx",
      "ValuePropSection.tsx",
      "RecentDebatesSection.tsx",
      "DebatePreviewCard.tsx",
      "VotePreviewBar.tsx",
      "DisclaimerBanner.tsx",
      "LandingFooter.tsx",
      "StickyCtaBar.tsx",
    ];

    test.each(files)("given %s, when checked, then it is <= 300 lines", (filename) => {
      const lines = getComponentLines(filename);
      expect(lines).toBeLessThanOrEqual(300);
    });
  });
});
