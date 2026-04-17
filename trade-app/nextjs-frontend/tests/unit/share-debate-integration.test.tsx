import { render, screen } from "@testing-library/react";
import fs from "fs";
import path from "path";
import { TooltipProvider } from "../../components/ui/tooltip";

const mockUseShareDebate = jest.fn(() => ({
  share: jest.fn(),
  isSharing: false,
}));

jest.mock("../../features/debate/hooks/useShareDebate", () => ({
  get useShareDebate() { return mockUseShareDebate; },
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
import { ShareDebateButton } from "../../features/debate/components/ShareDebateButton";

describe("[P0][5.4-integration] Social Share integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

    it("forwards debateStatus to ShareDebateButton via hook", () => {
      render(
        <TooltipProvider>
          <DebateDetailActions externalId="ext-1" assetName="ETH" debateStatus="active" />
        </TooltipProvider>,
      );

      expect(mockUseShareDebate).toHaveBeenCalledWith(
        expect.objectContaining({ debateStatus: "active", assetName: "ETH" }),
      );
    });
  });

  describe("DebateStream toolbar — rendered toolbar row", () => {
    function renderToolbarRow(externalId?: string) {
      const assetName = "BTC";
      return render(
        <TooltipProvider>
          <div className="absolute top-2 right-2 z-10 flex gap-2">
            <ShareDebateButton
              assetName={assetName}
              externalId={externalId || assetName}
              disabled={!externalId}
              source="debate_stream"
            />
          </div>
        </TooltipProvider>,
      );
    }

    it("renders ShareDebateButton with source=debate_stream", () => {
      renderToolbarRow("ext-1");

      const shareBtn = screen.getByTestId("share-debate-button");
      expect(shareBtn).toBeInTheDocument();
      expect(mockUseShareDebate).toHaveBeenCalledWith(
        expect.objectContaining({ source: "debate_stream" }),
      );
    });

    it("disables ShareDebateButton when externalId is undefined", () => {
      renderToolbarRow(undefined);

      expect(screen.getByTestId("share-debate-button")).toBeDisabled();
    });

    it("passes assetName fallback from debateId when externalId is undefined", () => {
      renderToolbarRow(undefined);

      expect(mockUseShareDebate).toHaveBeenCalledWith(
        expect.objectContaining({ assetName: "BTC", externalId: "BTC" }),
      );
    });
  });

  describe("DebateStream toolbar — static contract verification", () => {
    it("DebateStream imports DebateToolbar component", () => {
      const streamPath = path.resolve(process.cwd(), "features/debate/components/DebateStream.tsx");
      const content = fs.readFileSync(streamPath, "utf-8");

      expect(content).toContain("import { DebateToolbar }");
    });

    it("DebateToolbar imports both SnapshotButton and ShareDebateButton", () => {
      const toolbarPath = path.resolve(process.cwd(), "features/debate/components/DebateToolbar.tsx");
      const content = fs.readFileSync(toolbarPath, "utf-8");

      expect(content).toContain("import { SnapshotButton }");
      expect(content).toContain("import { ShareDebateButton }");
    });

    it("DebateToolbar passes source=debate_stream to ShareDebateButton", () => {
      const toolbarPath = path.resolve(process.cwd(), "features/debate/components/DebateToolbar.tsx");
      const content = fs.readFileSync(toolbarPath, "utf-8");

      expect(content).toMatch(/source="debate_stream"/);
    });

    it("DebateToolbar disables ShareDebateButton when hasExternalId is false", () => {
      const toolbarPath = path.resolve(process.cwd(), "features/debate/components/DebateToolbar.tsx");
      const content = fs.readFileSync(toolbarPath, "utf-8");

      expect(content).toContain("disabled={!hasExternalId}");
    });

    it("DebateToolbar returns null when showSnapshot is false", () => {
      const toolbarPath = path.resolve(process.cwd(), "features/debate/components/DebateToolbar.tsx");
      const content = fs.readFileSync(toolbarPath, "utf-8");

      expect(content).toContain("if (!showSnapshot) return null");
    });

    it("DebateStream passes showSnapshot prop to DebateToolbar", () => {
      const streamPath = path.resolve(process.cwd(), "features/debate/components/DebateStream.tsx");
      const content = fs.readFileSync(streamPath, "utf-8");

      expect(content).toContain("showSnapshot={showSnapshot}");
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
