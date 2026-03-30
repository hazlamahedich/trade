import { fireEvent, render, screen } from "@testing-library/react";
import { StaleDataWarning } from "../../features/debate/components/StaleDataWarning";

describe("[1-6-QA] StaleDataWarning Accessibility & Behavior", () => {
  const defaultProps = {
    lastUpdate: "2026-02-19T10:00:00Z",
    ageSeconds: 75,
    onAcknowledge: jest.fn(),
  };

  let originalVibrate: PropertyDescriptor | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    originalVibrate = Object.getOwnPropertyDescriptor(navigator, "vibrate");
    Object.defineProperty(navigator, "vibrate", {
      value: jest.fn(),
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalVibrate) {
      Object.defineProperty(navigator, "vibrate", originalVibrate);
    } else {
      Object.defineProperty(navigator, "vibrate", {
        value: undefined,
        configurable: true,
      });
    }
  });

  test("[1-6-QA-001] should trigger haptic vibration on mount", () => {
    render(<StaleDataWarning {...defaultProps} />);

    expect(navigator.vibrate).toHaveBeenCalledWith([100, 50, 100]);
  });

  test("[1-6-QA-002] should handle missing vibrate API gracefully", () => {
    delete (navigator as unknown as Record<string, unknown>).vibrate;

    expect(() => {
      render(<StaleDataWarning {...defaultProps} />);
    }).not.toThrow();
  });

  test("[1-6-QA-003] should trap Tab key within modal", () => {
    render(<StaleDataWarning {...defaultProps} />);

    const button = screen.getByTestId("stale-acknowledge-btn");
    button.focus();

    expect(document.activeElement).toBe(button);

    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(button);
  });

  test("[1-6-QA-004] should auto-focus acknowledge button on mount", () => {
    render(<StaleDataWarning {...defaultProps} />);

    const button = screen.getByTestId("stale-acknowledge-btn");
    expect(document.activeElement).toBe(button);
  });

  test("[1-6-QA-005] should render stale data warning with aria-live region", () => {
    render(<StaleDataWarning {...defaultProps} />);

    const liveRegion = screen.getByText(/Market data is 75 seconds old/);
    expect(liveRegion).toHaveAttribute("aria-live", "assertive");
  });

  test("[1-6-QA-006] should format invalid lastUpdate as Unknown", () => {
    render(<StaleDataWarning {...defaultProps} lastUpdate="not-a-date" />);

    expect(screen.getByText(/Last update:/)).toBeInTheDocument();
  });
});
