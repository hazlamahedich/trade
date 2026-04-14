import { render, screen, fireEvent } from "@testing-library/react";
import { DebateHistoryError } from "@/features/debate/components/DebateHistoryError";

describe("DebateHistoryError", () => {
  it("[P0] renders error message", () => {
    render(<DebateHistoryError />);
    expect(screen.getByText("Could not load debates")).toBeInTheDocument();
  });

  it("[P1] shows custom error message", () => {
    render(<DebateHistoryError error={new Error("Network failed")} />);
    expect(screen.getByText("Network failed")).toBeInTheDocument();
  });

  it("[P0] shows default error message when no error prop", () => {
    render(<DebateHistoryError />);
    expect(
      screen.getByText("Something went wrong. Please try again."),
    ).toBeInTheDocument();
  });

  it("[P0] renders retry CTA when reset is provided", () => {
    const reset = jest.fn();
    render(<DebateHistoryError reset={reset} />);
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("[P1] does not render retry when reset is not provided", () => {
    render(<DebateHistoryError />);
    expect(screen.queryByText("Try again")).not.toBeInTheDocument();
  });

  it("[P0] reset button calls reset callback on click", () => {
    const reset = jest.fn();
    render(<DebateHistoryError reset={reset} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("[P1] reset button has type button", () => {
    const reset = jest.fn();
    render(<DebateHistoryError reset={reset} />);
    const button = screen.getByText("Try again").closest("button");
    expect(button).toHaveAttribute("type", "button");
  });

  it("[P1] reset button has touch target sizing", () => {
    const reset = jest.fn();
    render(<DebateHistoryError reset={reset} />);
    const button = screen.getByText("Try again").closest("button");
    expect(button?.className).toContain("min-h-[44px]");
  });
});
