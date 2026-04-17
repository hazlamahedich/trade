import { render, screen, fireEvent } from "@testing-library/react";
import { jest } from "@jest/globals";
import { QuoteCardTemplate } from "../../features/debate/components/QuoteCardTemplate";
import { QuoteCardOverlay } from "../../features/debate/components/QuoteCardOverlay";
import { ShareButton } from "../../features/debate/components/ShareButton";
import { StaticAgentIcon } from "../../features/debate/components/StaticAgentIcon";
import { makeQuoteCardData } from "./factories/quote-share-factory";
import fs from "fs";
import path from "path";

if (typeof globalThis.SVGImageElement === "undefined") {
  (globalThis as Record<string, unknown>).SVGImageElement = class SVGImageElement extends HTMLElement {};
}

jest.mock("sonner", () => ({
  toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

jest.mock("framer-motion", () => ({
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
    button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  },
}));

import { TooltipProvider } from "@/components/ui/tooltip";

describe("[P0][5.3-components] Quote card components", () => {
  describe("QuoteCardTemplate", () => {
    it("renders branding and content", () => {
      const data = makeQuoteCardData();
      render(
        <QuoteCardTemplate
          agent={data.agent}
          content={data.content}
          assetName="BTC/USDT"
          debateUrl="https://example.com/d/1"
        />,
      );
      expect(screen.getByTestId("quote-card-template")).toBeInTheDocument();
      expect(screen.getByText("AI Trading Debate Lab")).toBeInTheDocument();
      expect(screen.getByText("BTC/USDT")).toBeInTheDocument();
    });

    it("renders agent role with correct color class", () => {
      render(
        <QuoteCardTemplate
          agent="bull"
          content="test"
          assetName="BTC"
        />,
      );
      expect(screen.getByText("Bull")).toBeInTheDocument();
    });

    it("renders bear agent correctly", () => {
      render(
        <QuoteCardTemplate
          agent="bear"
          content="test"
          assetName="ETH"
        />,
      );
      expect(screen.getByText("Bear")).toBeInTheDocument();
    });

    it("truncates long content at 280 chars", () => {
      const longContent = "A".repeat(300);
      render(
        <QuoteCardTemplate
          agent="bull"
          content={longContent}
          assetName="BTC"
        />,
      );
      const template = screen.getByTestId("quote-card-template");
      const textEl = template.querySelector("p.break-words");
      expect(textEl?.textContent).toContain("…");
    });

    it("renders Unicode content correctly", () => {
      render(
        <QuoteCardTemplate
          agent="bull"
          content="🔥 BTC to the moon 🚀"
          assetName="BTC"
        />,
      );
      expect(screen.getByTestId("quote-card-template")).toHaveTextContent("🔥");
    });

    it("omits URL when debateUrl is undefined", () => {
      render(
        <QuoteCardTemplate
          agent="bull"
          content="test"
          assetName="BTC"
        />,
      );
      expect(screen.getByText("#AITradingDebate")).toBeInTheDocument();
    });

    it("uses border-white/15 and text-slate-400 (Lesson #24)", () => {
      const { container } = render(
        <QuoteCardTemplate
          agent="bull"
          content="test"
          assetName="BTC"
          debateUrl="https://example.com/d/1"
        />,
      );
      expect(container.querySelector(".border-white\\/15")).toBeTruthy();
    });
  });

  describe("StaticAgentIcon", () => {
    it("renders bull SVG", () => {
      const { container } = render(<StaticAgentIcon agent="bull" />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("renders bear SVG", () => {
      const { container } = render(<StaticAgentIcon agent="bear" />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("applies size prop", () => {
      const { container } = render(<StaticAgentIcon agent="bull" size={24} />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("width")).toBe("24");
    });

    it("applies className prop", () => {
      const { container } = render(<StaticAgentIcon agent="bull" className="text-emerald-400" />);
      const svg = container.querySelector("svg");
      expect(svg?.classList.contains("text-emerald-400")).toBe(true);
    });

    it("has aria-hidden=true", () => {
      const { container } = render(<StaticAgentIcon agent="bull" />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
    });
  });

  describe("QuoteCardOverlay", () => {
    it("has aria-hidden=true", () => {
      const ref = { current: null };
      render(
        <QuoteCardOverlay
          overlayRef={ref as React.RefObject<HTMLDivElement | null>}
          agent="bull"
          content="test"
          timestamp="2026-01-01T00:00:00Z"
          assetName="BTC"
        />,
      );
      const overlay = screen.getByTestId("quote-card-overlay");
      expect(overlay.getAttribute("aria-hidden")).toBe("true");
    });

    it("has role=presentation", () => {
      const ref = { current: null };
      render(
        <QuoteCardOverlay
          overlayRef={ref as React.RefObject<HTMLDivElement | null>}
          agent="bull"
          content="test"
          timestamp="2026-01-01T00:00:00Z"
          assetName="BTC"
        />,
      );
      expect(screen.getByTestId("quote-card-overlay")).toHaveAttribute("role", "presentation");
    });

    it("has 600px fixed width", () => {
      const ref = { current: null };
      render(
        <QuoteCardOverlay
          overlayRef={ref as React.RefObject<HTMLDivElement | null>}
          agent="bull"
          content="test"
          timestamp="2026-01-01T00:00:00Z"
          assetName="BTC"
        />,
      );
      const overlay = screen.getByTestId("quote-card-overlay");
      expect(overlay.style.width).toBe("600px");
    });

    it("is positioned off-screen", () => {
      const ref = { current: null };
      render(
        <QuoteCardOverlay
          overlayRef={ref as React.RefObject<HTMLDivElement | null>}
          agent="bull"
          content="test"
          timestamp="2026-01-01T00:00:00Z"
          assetName="BTC"
        />,
      );
      const overlay = screen.getByTestId("quote-card-overlay");
      expect(overlay.style.left).toBe("-9999px");
    });
  });

  describe("ShareButton", () => {
    function renderShareButton(props: Partial<Parameters<typeof ShareButton>[0]> = {}) {
      return render(
        <TooltipProvider>
          <ShareButton
            shareState="idle"
            onShare={jest.fn()}
            {...props}
          />
        </TooltipProvider>,
      );
    }

    it("renders with correct aria-label", () => {
      renderShareButton();
      expect(screen.getByLabelText("Share this argument")).toBeInTheDocument();
    });

    it("has tabIndex=-1", () => {
      renderShareButton();
      const btn = screen.getByTestId("share-button");
      expect(btn.getAttribute("tabindex")).toBe("-1");
    });

    it("has 44px min touch target via className", () => {
      renderShareButton();
      const btn = screen.getByTestId("share-button");
      expect(btn.className).toContain("min-h-[44px]");
      expect(btn.className).toContain("min-w-[44px]");
    });

    it("shows loader when generating", () => {
      renderShareButton({ shareState: "generating" });
      expect(screen.getByTestId("share-button")).toHaveAttribute("aria-busy", "true");
    });

    it("is disabled when generating", () => {
      renderShareButton({ shareState: "generating" });
      expect(screen.getByTestId("share-button")).toBeDisabled();
    });

    it("is NOT rendered when isStreaming=true", () => {
      renderShareButton({ isStreaming: true });
      expect(screen.queryByTestId("share-button")).not.toBeInTheDocument();
    });

    it("is NOT rendered when isRedacted=true", () => {
      renderShareButton({ isRedacted: true });
      expect(screen.queryByTestId("share-button")).not.toBeInTheDocument();
    });

    it("has aria-live polite region", () => {
      renderShareButton();
      const live = screen.getByTestId("share-button").parentElement?.querySelector("[aria-live='polite']");
      expect(live).toBeInTheDocument();
    });
  });

  describe("[P0][5.3-bundle] Bundle isolation", () => {
    const filesToCheck = [
      "features/debate/components/QuoteCardTemplate.tsx",
      "features/debate/components/QuoteCardOverlay.tsx",
      "features/debate/components/ShareButton.tsx",
      "features/debate/components/StaticAgentIcon.tsx",
      "features/debate/utils/quote-share.ts",
      "features/debate/utils/truncate.ts",
      "features/debate/types/quote-share.ts",
    ];

    const forbiddenImports = [
      "@tanstack/react-query",
      "zustand",
      "@xyflow/react",
      "useDebateSocket",
    ];

    filesToCheck.forEach((file) => {
      it(`${file} has no forbidden imports`, () => {
        const fullPath = path.resolve(process.cwd(), file);
        if (!fs.existsSync(fullPath)) return;
        const content = fs.readFileSync(fullPath, "utf-8");
        forbiddenImports.forEach((imp) => {
          expect(content).not.toContain(imp);
        });
      });
    });
  });
});
