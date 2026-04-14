import { render, screen } from "@testing-library/react";
import { DebateHistorySkeleton } from "@/features/debate/components/DebateHistorySkeleton";

describe("DebateHistorySkeleton", () => {
  it("renders 6 skeleton cards", () => {
    const { container } = render(<DebateHistorySkeleton />);
    const cards = container.querySelectorAll(".rounded-lg.border");
    expect(cards).toHaveLength(6);
  });

  it("has aria-busy attribute", () => {
    render(<DebateHistorySkeleton />);
    expect(screen.getByLabelText("Loading debates")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});
