import { render, screen, fireEvent } from "@testing-library/react";
import { DebateHistoryEmpty } from "@/features/debate/components/DebateHistoryEmpty";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("DebateHistoryEmpty", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders filtered-empty state with clear-filters CTA", () => {
    render(<DebateHistoryEmpty hasActiveFilters={true} />);
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

  it("clear button navigates to debates page", () => {
    render(<DebateHistoryEmpty hasActiveFilters={true} />);
    fireEvent.click(screen.getByText("Clear all filters"));
    expect(mockPush).toHaveBeenCalledWith("/dashboard/debates");
  });

  it("clear button has aria-label", () => {
    render(<DebateHistoryEmpty hasActiveFilters={true} />);
    expect(
      screen.getByLabelText("Clear all filters"),
    ).toBeInTheDocument();
  });

  it("clear button has touch target sizing", () => {
    render(<DebateHistoryEmpty hasActiveFilters={true} />);
    const button = screen.getByLabelText("Clear all filters");
    expect(button.className).toContain("min-h-[44px]");
  });

  it("clear button has type button", () => {
    render(<DebateHistoryEmpty hasActiveFilters={true} />);
    const button = screen.getByLabelText("Clear all filters");
    expect(button).toHaveAttribute("type", "button");
  });
});
