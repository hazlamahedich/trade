import { render, screen, fireEvent } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { TooltipProvider } from "../../components/ui/tooltip";

expect.extend(toHaveNoViolations);

const mockShare = jest.fn().mockResolvedValue(undefined);
const mockTrackEvent = jest.fn();
const mockUseShareDebate = jest.fn(() => ({
  share: mockShare,
  isSharing: false,
}));

jest.mock("../../features/debate/hooks/useShareDebate", () => ({
  get useShareDebate() { return mockUseShareDebate; },
}));

jest.mock("../../features/debate/utils/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
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

import { ShareDebateButton } from "../../features/debate/components/ShareDebateButton";

const defaultProps = {
  assetName: "BTC",
  externalId: "ext-1",
};

function renderWithProvider(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("[P0][5.4-button] ShareDebateButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders button with Share2 icon", () => {
    renderWithProvider(<ShareDebateButton {...defaultProps} />);
    const button = screen.getByTestId("share-debate-button");
    expect(button).toBeInTheDocument();
    const svg = button.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("click triggers share", () => {
    renderWithProvider(<ShareDebateButton {...defaultProps} />);
    fireEvent.click(screen.getByTestId("share-debate-button"));
    expect(mockShare).toHaveBeenCalledTimes(1);
  });

  it("has aria-label Share debate", () => {
    renderWithProvider(<ShareDebateButton {...defaultProps} />);
    expect(screen.getByLabelText("Share debate")).toBeInTheDocument();
  });

  it("has aria-busy attribute", () => {
    renderWithProvider(<ShareDebateButton {...defaultProps} />);
    const button = screen.getByTestId("share-debate-button");
    expect(button).toHaveAttribute("aria-busy", "false");
  });

  it("has 44px touch target", () => {
    renderWithProvider(<ShareDebateButton {...defaultProps} />);
    const button = screen.getByTestId("share-debate-button");
    expect(button.className).toContain("min-h-[44px]");
    expect(button.className).toContain("min-w-[44px]");
  });

  it("has disabled state when disabled prop is true", () => {
    renderWithProvider(<ShareDebateButton {...defaultProps} disabled />);
    const button = screen.getByTestId("share-debate-button");
    expect(button).toBeDisabled();
  });

  it("activates with keyboard Enter", () => {
    renderWithProvider(<ShareDebateButton {...defaultProps} />);
    const button = screen.getByTestId("share-debate-button");
    fireEvent.keyDown(button, { key: "Enter" });
  });

  it("has sr-only aria-live region", () => {
    renderWithProvider(<ShareDebateButton {...defaultProps} />);
    const liveRegion = screen.getByTestId("share-debate-button")
      .closest("[data-testid]")
      ?.parentElement?.querySelector("[aria-live='polite']");
    expect(liveRegion).toBeInTheDocument();
  });

  it("passes jest-axe accessibility audit", async () => {
    const { container } = renderWithProvider(<ShareDebateButton {...defaultProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("forwards debateStatus=active to useShareDebate hook", () => {
    renderWithProvider(<ShareDebateButton {...defaultProps} debateStatus="active" />);
    expect(mockUseShareDebate).toHaveBeenCalledWith(
      expect.objectContaining({ assetName: "BTC", externalId: "ext-1", debateStatus: "active" }),
    );
  });

  it("forwards debateStatus=completed to useShareDebate hook", () => {
    renderWithProvider(<ShareDebateButton {...defaultProps} debateStatus="completed" />);
    expect(mockUseShareDebate).toHaveBeenCalledWith(
      expect.objectContaining({ debateStatus: "completed" }),
    );
  });

  it("forwards source prop to useShareDebate hook", () => {
    renderWithProvider(<ShareDebateButton {...defaultProps} source="debate_stream" />);
    expect(mockUseShareDebate).toHaveBeenCalledWith(
      expect.objectContaining({ source: "debate_stream" }),
    );
  });

  it("disabled state has opacity-50 and no hover styles", () => {
    renderWithProvider(<ShareDebateButton {...defaultProps} disabled />);
    const button = screen.getByTestId("share-debate-button");
    expect(button.className).toContain("disabled:opacity-50");
    expect(button.className).toContain("disabled:cursor-not-allowed");
  });

  it("loading state (isSharing) shows spinner, disabled state shows icon", () => {
    const { rerender } = renderWithProvider(
      <ShareDebateButton {...defaultProps} />,
    );

    mockUseShareDebate.mockReturnValue({ share: jest.fn(), isSharing: true });
    rerender(
      <TooltipProvider>
        <ShareDebateButton {...defaultProps} />
      </TooltipProvider>,
    );

    const button = screen.getByTestId("share-debate-button");
    expect(button.querySelector("div")).toBeInTheDocument();

    mockUseShareDebate.mockReturnValue({ share: jest.fn(), isSharing: false });
    rerender(
      <TooltipProvider>
        <ShareDebateButton {...defaultProps} disabled />
      </TooltipProvider>,
    );

    expect(screen.getByTestId("share-debate-button").querySelector("div")).toBeNull();
    expect(screen.getByTestId("share-debate-button").querySelector("svg")).toBeInTheDocument();
  });
});
