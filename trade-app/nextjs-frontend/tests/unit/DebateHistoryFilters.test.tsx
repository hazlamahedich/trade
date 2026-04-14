import { render, screen, fireEvent } from "@testing-library/react";
import { DebateHistoryFilters } from "@/features/debate/components/DebateHistoryFilters";

const mockPush = jest.fn();
const mockGet = jest.fn(() => null);

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockGet }),
}));

describe("DebateHistoryFilters", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockGet.mockReset();
    mockGet.mockReturnValue(null);
  });

  it("renders asset select with aria-label", () => {
    render(<DebateHistoryFilters />);
    expect(screen.getByLabelText("Filter by asset")).toBeInTheDocument();
  });

  it("renders outcome select with aria-label", () => {
    render(<DebateHistoryFilters />);
    expect(screen.getByLabelText("Filter by outcome")).toBeInTheDocument();
  });

  it("renders clear button when asset filter is active", () => {
    mockGet.mockImplementation((key: string) => {
      if (key === "asset") return "btc";
      return null;
    });
    render(<DebateHistoryFilters />);
    expect(screen.getByLabelText("Clear all filters")).toBeInTheDocument();
  });

  it("renders clear button when outcome filter is active", () => {
    mockGet.mockImplementation((key: string) => {
      if (key === "outcome") return "bull";
      return null;
    });
    render(<DebateHistoryFilters />);
    expect(screen.getByLabelText("Clear all filters")).toBeInTheDocument();
  });

  it("does not render clear button when no filters active", () => {
    render(<DebateHistoryFilters />);
    expect(screen.queryByLabelText("Clear all filters")).not.toBeInTheDocument();
  });

  it("clear button resets all filters in URL", () => {
    mockGet.mockImplementation((key: string) => {
      if (key === "asset") return "btc";
      if (key === "outcome") return "bull";
      return null;
    });
    render(<DebateHistoryFilters />);
    fireEvent.click(screen.getByLabelText("Clear all filters"));
    expect(mockPush).toHaveBeenCalledTimes(1);
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain("page=1");
    expect(pushedUrl).not.toContain("asset=");
    expect(pushedUrl).not.toContain("outcome=");
  });

  it("uses initialAsset as fallback when no search param", () => {
    mockGet.mockReturnValue(null);
    render(<DebateHistoryFilters initialAsset="eth" />);
    expect(screen.getByLabelText("Filter by asset")).toBeInTheDocument();
  });

  it("uses initialOutcome as fallback when no search param", () => {
    mockGet.mockReturnValue(null);
    render(<DebateHistoryFilters initialOutcome="bear" />);
    expect(screen.getByLabelText("Filter by outcome")).toBeInTheDocument();
  });

  it("preserves page size in URL when clear button clicked", () => {
    mockGet.mockImplementation((key: string) => {
      if (key === "size") return "10";
      if (key === "asset") return "btc";
      return null;
    });
    render(<DebateHistoryFilters />);
    fireEvent.click(screen.getByLabelText("Clear all filters"));
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain("size=10");
  });

  it("has touch target sizing on clear button", () => {
    mockGet.mockImplementation((key: string) => {
      if (key === "asset") return "btc";
      return null;
    });
    render(<DebateHistoryFilters />);
    const clearButton = screen.getByLabelText("Clear all filters");
    expect(clearButton.className).toContain("min-h-[44px]");
  });
});
