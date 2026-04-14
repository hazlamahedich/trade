import { render, screen, fireEvent } from "@testing-library/react";
import { DebateHistoryFilterChips } from "@/features/debate/components/DebateHistoryFilterChips";

const mockPush = jest.fn();
const mockToString = jest.fn(() => "asset=btc&outcome=bull&page=2");

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ toString: mockToString }),
}));

describe("DebateHistoryFilterChips", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockToString.mockReturnValue("asset=btc&outcome=bull&page=2");
  });

  it("[P0] renders null when no filters active", () => {
    const { container } = render(
      <DebateHistoryFilterChips asset="" outcome="" />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("[P0] renders asset chip when asset is provided", () => {
    render(<DebateHistoryFilterChips asset="btc" outcome="" />);
    expect(screen.getByText(/Asset: BTC/)).toBeInTheDocument();
  });

  it("[P0] renders outcome chip when outcome is provided", () => {
    render(<DebateHistoryFilterChips asset="" outcome="bull" />);
    expect(screen.getByText(/Outcome: Bull Wins/)).toBeInTheDocument();
  });

  it("[P0] renders both chips when both filters active", () => {
    render(<DebateHistoryFilterChips asset="eth" outcome="bear" />);
    expect(screen.getByText(/Asset: ETH/)).toBeInTheDocument();
    expect(screen.getByText(/Outcome: Bear Wins/)).toBeInTheDocument();
  });

  it("[P1] renders outcome label for undecided", () => {
    render(<DebateHistoryFilterChips asset="" outcome="undecided" />);
    expect(screen.getByText(/Outcome: Undecided/)).toBeInTheDocument();
  });

  it("[P1] renders raw value for unknown outcome", () => {
    render(<DebateHistoryFilterChips asset="" outcome="custom" />);
    expect(screen.getByText(/Outcome: custom/)).toBeInTheDocument();
  });

  it("[P0] chip has remove button with correct aria-label", () => {
    render(<DebateHistoryFilterChips asset="btc" outcome="" />);
    expect(
      screen.getByLabelText("Remove Asset filter"),
    ).toBeInTheDocument();
  });

  it("[P0] outcome chip has correct aria-label", () => {
    render(<DebateHistoryFilterChips asset="" outcome="bull" />);
    expect(
      screen.getByLabelText("Remove Outcome filter"),
    ).toBeInTheDocument();
  });

  it("[P1] container has aria-label Active filters", () => {
    render(<DebateHistoryFilterChips asset="btc" outcome="" />);
    expect(screen.getByLabelText("Active filters")).toBeInTheDocument();
  });

  it("[P0] chip remove updates URL and resets to page 1", () => {
    mockToString.mockReturnValue("asset=btc&page=2");
    render(<DebateHistoryFilterChips asset="btc" outcome="" />);
    fireEvent.click(screen.getByLabelText("Remove Asset filter"));
    expect(mockPush).toHaveBeenCalledTimes(1);
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain("page=1");
    expect(pushedUrl).not.toContain("asset=");
  });

  it("[P1] has touch target sizing on chip buttons", () => {
    render(<DebateHistoryFilterChips asset="btc" outcome="" />);
    const button = screen.getByLabelText("Remove Asset filter");
    expect(button.className).toContain("min-h-[44px]");
  });

  it("[P1] renders chips as buttons with type button", () => {
    render(<DebateHistoryFilterChips asset="btc" outcome="" />);
    const button = screen.getByLabelText("Remove Asset filter");
    expect(button).toHaveAttribute("type", "button");
  });
});
