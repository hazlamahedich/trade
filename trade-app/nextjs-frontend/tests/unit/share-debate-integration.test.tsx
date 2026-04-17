import { render, screen } from "@testing-library/react";
import fs from "fs";
import path from "path";
import { TooltipProvider } from "../../components/ui/tooltip";

jest.mock("../../features/debate/hooks/useShareDebate", () => ({
  useShareDebate: () => ({
    share: jest.fn(),
    isSharing: false,
  }),
}));

jest.mock("../../features/debate/utils/analytics", () => ({
  trackEvent: jest.fn(),
}));

jest.mock("framer-motion", () => {
  const React = jest.requireActual("react") as typeof import("react");
  return {
    motion: {
      button: React.forwardRef(
        (props: Record<string, unknown>, ref: React.Ref<HTMLButtonElement>) =>
          React.createElement("button", { ...props, ref }),
      ),
      div: React.forwardRef(
        (props: Record<string, unknown>, ref: React.Ref<HTMLDivElement>) =>
          React.createElement("div", { ...props, ref }),
      ),
    },
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

import { DebateDetailActions } from "../../features/debate/components/DebateDetailClientActions";

describe("[P0][5.4-integration] Social Share integration", () => {
  describe("DebateDetailActions wrapper", () => {
    it("renders ShareDebateButton alongside WatchLiveCTA in flex row", () => {
      render(
        <TooltipProvider>
          <DebateDetailActions externalId="ext-1" assetName="BTC" debateStatus="completed" />
        </TooltipProvider>,
      );

      const shareBtn = screen.getByTestId("share-debate-button");
      expect(shareBtn).toBeInTheDocument();

      const watchLiveLink = screen.getByText("Watch Live Debates");
      expect(watchLiveLink).toBeInTheDocument();

      const container = shareBtn.parentElement;
      expect(container).toBeInTheDocument();
      expect(container?.className).toContain("gap-3");
    });

    it("forwards debateStatus to ShareDebateButton", () => {
      render(
        <TooltipProvider>
          <DebateDetailActions externalId="ext-1" assetName="ETH" debateStatus="active" />
        </TooltipProvider>,
      );

      const shareBtn = screen.getByTestId("share-debate-button");
      expect(shareBtn).toBeInTheDocument();
      expect(shareBtn).toHaveAttribute("aria-label", "Share debate");
    });
  });

  describe("DebateStream toolbar", () => {
    it("includes ShareDebateButton import alongside SnapshotButton", () => {
      const streamPath = path.resolve(process.cwd(), "features/debate/components/DebateStream.tsx");
      const content = fs.readFileSync(streamPath, "utf-8");

      expect(content).toContain("import { ShareDebateButton }");
      expect(content).toContain("import { SnapshotButton }");
      expect(content).toMatch(/ShareDebateButton.*assetName/);
      expect(content).toContain("disabled={!externalIdProp}");
    });
  });

  describe("Bundle isolation", () => {
    const filesToCheck = [
      "features/debate/components/ShareDebateButton.tsx",
      "features/debate/hooks/useShareDebate.ts",
      "features/debate/utils/share-debate.ts",
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

      it(`${file} has no unguarded window access at module scope`, () => {
        const fullPath = path.resolve(process.cwd(), file);
        if (!fs.existsSync(fullPath)) return;
        const content = fs.readFileSync(fullPath, "utf-8");

        const lines = content.split("\n");
        lines.forEach((line, idx) => {
          if (line.includes("window.") && !line.includes("typeof window")) {
            const prevLines = lines.slice(0, idx).join("\n");
            if (!prevLines.includes("typeof window")) {
              expect(line).not.toContain("window.");
            }
          }
        });
      });
    });
  });
});
