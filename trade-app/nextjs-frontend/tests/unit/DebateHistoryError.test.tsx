import { render, screen, fireEvent } from "@testing-library/react";
import { DebateHistoryError } from "@/features/debate/components/DebateHistoryError";

describe("DebateHistoryError", () => {
  it("renders error message", () => {
    render(<DebateHistoryError />);
    expect(screen.getByText("Could not load debates")).toBeInTheDocument();
  });

  it("shows custom error message", () => {
    render(<DebateHistoryError error={new Error("Network failed")} />);
    expect(screen.getByText("Network failed")).toBeInTheDocument();
  });

  it("shows default error message when no error prop", () => {
    render(<DebateHistoryError />);
    expect(
      screen.getByText("Something went wrong. Please try again."),
    ).toBeInTheDocument();
  });

  it("renders retry CTA when reset is provided", () => {
    const reset = jest.fn();
    render(<DebateHistoryError reset={reset} />);
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("does not render retry when reset is not provided", () => {
    render(<DebateHistoryError />);
    expect(screen.queryByText("Try again")).not.toBeInTheDocument();
  });

  it("reset button calls reset callback on click", () => {
    const reset = jest.fn();
    render(<DebateHistoryError reset={reset} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("reset button has type button", () => {
    const reset = jest.fn();
    render(<DebateHistoryError reset={reset} />);
    const button = screen.getByText("Try again").closest("button");
    expect(button).toHaveAttribute("type", "button");
  });

  it("reset button has touch target sizing", () => {
    const reset = jest.fn();
    render(<DebateHistoryError reset={reset} />);
    const button = screen.getByText("Try again").closest("button");
    expect(button?.className).toContain("min-h-[44px]");
  });
});
