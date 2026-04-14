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

  it("[P0] renders asset select with aria-label", () => {
    render(<DebateHistoryFilters />);
    expect(screen.getByLabelText("Filter by asset")).toBeInTheDocument();
  });

  it("[P0] renders outcome select with aria-label", () => {
    render(<DebateHistoryFilters />);
    expect(screen.getByLabelText("Filter by outcome")).toBeInTheDocument();
  });

  it("[P0] renders clear button when asset filter is active", () => {
    mockGet.mockImplementation((key: string) => {
      if (key === "asset") return "btc";
      return null;
    });
    render(<DebateHistoryFilters />);
    expect(screen.getByLabelText("Clear all filters")).toBeInTheDocument();
  });

  it("[P0] renders clear button when outcome filter is active", () => {
    mockGet.mockImplementation((key: string) => {
      if (key === "outcome") return "bull";
      return null;
    });
    render(<DebateHistoryFilters />);
    expect(screen.getByLabelText("Clear all filters")).toBeInTheDocument();
  });

  it("[P1] does not render clear button when no filters active", () => {
    render(<DebateHistoryFilters />);
    expect(screen.queryByLabelText("Clear all filters")).not.toBeInTheDocument();
  });

  it("[P0] clear button resets all filters in URL", () => {
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

  it("[P1] uses initialAsset as fallback when no search param", () => {
    mockGet.mockReturnValue(null);
    render(<DebateHistoryFilters initialAsset="eth" />);
    expect(screen.getByLabelText("Filter by asset")).toBeInTheDocument();
  });

  it("[P1] uses initialOutcome as fallback when no search param", () => {
    mockGet.mockReturnValue(null);
    render(<DebateHistoryFilters initialOutcome="bear" />);
    expect(screen.getByLabelText("Filter by outcome")).toBeInTheDocument();
  });

  it("[P1] preserves page size in URL when clear button clicked", () => {
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

  it("[P1] has touch target sizing on clear button", () => {
    mockGet.mockImplementation((key: string) => {
      if (key === "asset") return "btc";
      return null;
    });
    render(<DebateHistoryFilters />);
    const clearButton = screen.getByLabelText("Clear all filters");
    expect(clearButton.className).toContain("min-h-[44px]");
  });
});
