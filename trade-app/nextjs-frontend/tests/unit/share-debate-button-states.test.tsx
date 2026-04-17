import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "../../components/ui/tooltip";

const mockState = {
  isSharing: false,
  reduceMotion: false,
  capturedButtonProps: {} as Record<string, unknown>,
};

jest.mock("../../features/debate/hooks/useShareDebate", () => ({
  useShareDebate: () => ({
    share: jest.fn(),
    isSharing: mockState.isSharing,
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
        (props: Record<string, unknown>, ref: React.Ref<HTMLButtonElement>) => {
          mockState.capturedButtonProps = props;
          return React.createElement("button", { ...props, ref });
        },
      ),
      div: React.forwardRef(
        (props: Record<string, unknown>, ref: React.Ref<HTMLDivElement>) =>
          React.createElement("div", { ...props, ref }),
      ),
    },
    useReducedMotion: () => mockState.reduceMotion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

import { ShareDebateButton } from "../../features/debate/components/ShareDebateButton";

const defaultProps = { assetName: "BTC", externalId: "ext-1" };

describe("[P0][5.4-button-states] ShareDebateButton state variations", () => {
  beforeEach(() => {
    mockState.isSharing = false;
    mockState.reduceMotion = false;
    mockState.capturedButtonProps = {};
  });

  describe("useReducedMotion", () => {
    it("sets transition duration to 0 when reduced motion preferred", () => {
      mockState.reduceMotion = true;
      render(
        <TooltipProvider>
          <ShareDebateButton {...defaultProps} />
        </TooltipProvider>,
      );

      const button = screen.getByTestId("share-debate-button");
      expect(button).toBeInTheDocument();
      const transition = mockState.capturedButtonProps.transition as Record<string, unknown>;
      expect(transition.duration).toBe(0);
    });

    it("sets transition duration > 0 when reduced motion not preferred", () => {
      mockState.reduceMotion = false;
      render(
        <TooltipProvider>
          <ShareDebateButton {...defaultProps} />
        </TooltipProvider>,
      );

      const button = screen.getByTestId("share-debate-button");
      expect(button).toBeInTheDocument();
      const transition = mockState.capturedButtonProps.transition as Record<string, unknown>;
      expect(transition.duration).toBe(0.2);
    });

    it("disables initial animation when reduced motion preferred", () => {
      mockState.reduceMotion = true;
      render(
        <TooltipProvider>
          <ShareDebateButton {...defaultProps} />
        </TooltipProvider>,
      );

      expect(mockState.capturedButtonProps.initial).toBe(false);
    });
  });

  describe("isSharing state", () => {
    it("renders Loader2 icon when isSharing is true", () => {
      mockState.isSharing = true;
      render(
        <TooltipProvider>
          <ShareDebateButton {...defaultProps} />
        </TooltipProvider>,
      );

      const button = screen.getByTestId("share-debate-button");
      expect(button).toHaveAttribute("aria-busy", "true");

      const spinningDiv = button.querySelector("div");
      expect(spinningDiv).toBeInTheDocument();
    });

    it("renders Share2 icon when isSharing is false", () => {
      mockState.isSharing = false;
      render(
        <TooltipProvider>
          <ShareDebateButton {...defaultProps} />
        </TooltipProvider>,
      );

      const button = screen.getByTestId("share-debate-button");
      expect(button).toHaveAttribute("aria-busy", "false");

      const svg = button.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(button.querySelector("div")).toBeNull();
    });

    it("is disabled during isSharing", () => {
      mockState.isSharing = true;
      render(
        <TooltipProvider>
          <ShareDebateButton {...defaultProps} />
        </TooltipProvider>,
      );

      expect(screen.getByTestId("share-debate-button")).toBeDisabled();
    });
  });
});
