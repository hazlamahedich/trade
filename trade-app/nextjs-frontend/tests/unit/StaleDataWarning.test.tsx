import { fireEvent, render, screen } from "@testing-library/react";
import { StaleDataWarning } from "../../features/debate/components/StaleDataWarning";

describe("[1-6] StaleDataWarning Component", () => {
  const defaultProps = {
    lastUpdate: "2026-02-19T10:00:00Z",
    ageSeconds: 75,
    onAcknowledge: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("[1-6-UI-001] should render stale data warning modal", () => {
    render(<StaleDataWarning {...defaultProps} />);

    expect(screen.getByTestId("stale-data-warning")).toBeInTheDocument();
    expect(screen.getByText("Data Stale")).toBeInTheDocument();
    expect(screen.getByText(/Market data is 75 seconds old/)).toBeInTheDocument();
    expect(screen.getByText(/Last update:/)).toBeInTheDocument();
    expect(screen.getByText(/Debate paused for your protection/)).toBeInTheDocument();
  });

  test("[1-6-UI-002] should call onAcknowledge when button clicked", () => {
    render(<StaleDataWarning {...defaultProps} />);

    const button = screen.getByTestId("stale-acknowledge-btn");
    fireEvent.click(button);

    expect(defaultProps.onAcknowledge).toHaveBeenCalledTimes(1);
  });

  test("[1-6-UI-003] should have correct ARIA attributes", () => {
    render(<StaleDataWarning {...defaultProps} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "stale-data-title");
    expect(dialog).toHaveAttribute("aria-describedby", "stale-data-description");
  });

  test("[1-6-UI-004] should handle null lastUpdate", () => {
    render(<StaleDataWarning {...defaultProps} lastUpdate={null} />);

    expect(screen.getByText(/Last update: Unknown/)).toBeInTheDocument();
  });

  test("[1-6-UI-005] should have acknowledge button text", () => {
    render(<StaleDataWarning {...defaultProps} />);

    expect(screen.getByText("I Understand")).toBeInTheDocument();
  });
});
