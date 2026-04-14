import { render, screen } from "@testing-library/react";
import { DebateHistorySkeleton } from "@/features/debate/components/DebateHistorySkeleton";

describe("DebateHistorySkeleton", () => {
  it("[P0] renders 6 skeleton cards", () => {
    render(<DebateHistorySkeleton />);
    const cards = screen.getAllByTestId("skeleton-card");
    expect(cards).toHaveLength(6);
  });

  it("[P0] has aria-busy attribute", () => {
    render(<DebateHistorySkeleton />);
    expect(screen.getByLabelText("Loading debates")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});
