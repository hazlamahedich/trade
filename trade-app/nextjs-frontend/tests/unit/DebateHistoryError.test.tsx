import { render, screen } from "@testing-library/react";
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

  it("renders retry CTA when reset is provided", () => {
    const reset = jest.fn();
    render(<DebateHistoryError reset={reset} />);
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("does not render retry when reset is not provided", () => {
    render(<DebateHistoryError />);
    expect(screen.queryByText("Try again")).not.toBeInTheDocument();
  });
});
