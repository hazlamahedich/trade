import { render, screen } from "@testing-library/react";
import { DebateHistoryEmpty } from "@/features/debate/components/DebateHistoryEmpty";

describe("DebateHistoryEmpty", () => {
  it("renders filtered-empty state with clear-filters CTA", () => {
    const onClear = jest.fn();
    render(
      <DebateHistoryEmpty hasActiveFilters={true} onClearFilters={onClear} />,
    );
    expect(
      screen.getByText("No debates match your filters"),
    ).toBeInTheDocument();
    expect(screen.getByText("Clear all filters")).toBeInTheDocument();
  });

  it("renders true-empty state when no filters active", () => {
    render(<DebateHistoryEmpty hasActiveFilters={false} />);
    expect(screen.getByText("No debates yet")).toBeInTheDocument();
    expect(
      screen.queryByText("Clear all filters"),
    ).not.toBeInTheDocument();
  });
});
