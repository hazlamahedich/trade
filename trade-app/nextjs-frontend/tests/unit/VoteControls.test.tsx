import { render, screen, fireEvent } from "@testing-library/react";
import { VoteControls } from "../../features/debate/components/VoteControls";
import type { VoteChoice, VoteStatus } from "../../features/debate/hooks/useVote";

const mockUseReducedMotion = jest.fn(() => false);
jest.mock("framer-motion", () => ({
  ...jest.requireActual("framer-motion"),
  useReducedMotion: () => mockUseReducedMotion(),
}));

describe("[3-2-UNIT] VoteControls Component", () => {
  const defaultProps = {
    vote: jest.fn(),
    userVote: null as VoteChoice | null,
    voteStatus: "idle" as VoteStatus,
    disabled: false,
    isFrozen: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseReducedMotion.mockReturnValue(false);
  });

  test("[3-2-UNIT-VC01] renders both vote buttons with correct labels and icons @p0", () => {
    render(<VoteControls {...defaultProps} />);

    const bullBtn = screen.getByTestId("vote-bull-btn");
    const bearBtn = screen.getByTestId("vote-bear-btn");

    expect(bullBtn).toBeInTheDocument();
    expect(bearBtn).toBeInTheDocument();
    expect(bullBtn).toHaveTextContent("Bull Won");
    expect(bearBtn).toHaveTextContent("Bear Won");
  });

  test("[3-2-UNIT-VC02] clicking Bull button triggers vote('bull') @p0", () => {
    const vote = jest.fn();
    render(<VoteControls {...defaultProps} vote={vote} />);

    fireEvent.click(screen.getByTestId("vote-bull-btn"));
    expect(vote).toHaveBeenCalledWith("bull");
  });

  test("[3-2-UNIT-VC03] clicking Bear button triggers vote('bear') @p0", () => {
    const vote = jest.fn();
    render(<VoteControls {...defaultProps} vote={vote} />);

    fireEvent.click(screen.getByTestId("vote-bear-btn"));
    expect(vote).toHaveBeenCalledWith("bear");
  });

  test("[3-2-UNIT-VC04] buttons disabled when voteStatus === 'voting' @p0", () => {
    render(<VoteControls {...defaultProps} voteStatus="voting" />);

    expect(screen.getByTestId("vote-bull-btn")).toBeDisabled();
    expect(screen.getByTestId("vote-bear-btn")).toBeDisabled();
  });

  test("[3-2-UNIT-VC04b] voting button shows Voting… text and pulse @p0", () => {
    render(<VoteControls {...defaultProps} voteStatus="voting" userVote="bull" />);

    const bullBtn = screen.getByTestId("vote-bull-btn");
    expect(bullBtn).toHaveTextContent("Voting…");
    expect(bullBtn.className).toContain("animate-pulse");
  });

  test("[3-2-UNIT-VC05] rapid double-click — second click ignored when voting @p0", () => {
    const vote = jest.fn();
    const { rerender } = render(
      <VoteControls {...defaultProps} vote={vote} voteStatus="idle" />,
    );

    const bullBtn = screen.getByTestId("vote-bull-btn");
    fireEvent.click(bullBtn);
    expect(vote).toHaveBeenCalledTimes(1);

    rerender(<VoteControls {...defaultProps} vote={vote} voteStatus="voting" />);
    fireEvent.click(bullBtn);
    expect(vote).toHaveBeenCalledTimes(1);
  });

  test("[3-2-UNIT-VC06] selected state styling on voted button @p1", () => {
    render(<VoteControls {...defaultProps} userVote="bull" voteStatus="voted" />);

    const bullBtn = screen.getByTestId("vote-bull-btn");
    expect(bullBtn.className).toContain("ring-2");
    expect(bullBtn.className).toContain("ring-emerald-400");
  });

  test("[3-2-UNIT-VC07] dynamic aria-label — idle shows 'Vote Bull Won' @p0", () => {
    render(<VoteControls {...defaultProps} />);

    expect(screen.getByTestId("vote-bull-btn")).toHaveAttribute(
      "aria-label",
      "Vote Bull Won",
    );
    expect(screen.getByTestId("vote-bear-btn")).toHaveAttribute(
      "aria-label",
      "Vote Bear Won",
    );
  });

  test("[3-2-UNIT-VC07b] dynamic aria-label — voted shows 'cannot be changed' @p0", () => {
    render(<VoteControls {...defaultProps} userVote="bull" voteStatus="voted" />);

    expect(screen.getByTestId("vote-bull-btn")).toHaveAttribute(
      "aria-label",
      "You voted Bull Won — cannot be changed",
    );
  });

  test("[3-2-UNIT-VC08] data-testid attributes present @p0", () => {
    render(<VoteControls {...defaultProps} />);

    expect(screen.getByTestId("vote-bull-btn")).toBeTruthy();
    expect(screen.getByTestId("vote-bear-btn")).toBeTruthy();
  });

  test("[3-2-UNIT-VC09] reduced motion respected @p1", () => {
    mockUseReducedMotion.mockReturnValue(true);
    render(<VoteControls {...defaultProps} userVote={null} voteStatus="idle" />);

    const region = screen.getByRole("region", { name: /vote on debate outcome/i });
    expect(region).toBeInTheDocument();
  });

  test("[3-2-UNIT-VC10] Guardian freeze — buttons disabled with micro-label @p0", () => {
    render(<VoteControls {...defaultProps} isFrozen={true} />);

    expect(screen.getByTestId("vote-bull-btn")).toBeDisabled();
    expect(screen.getByTestId("vote-bear-btn")).toBeDisabled();
    expect(screen.getByText("Voting paused during risk review")).toBeInTheDocument();
  });

  test("[3-2-UNIT-VC11] keyboard navigation — Tab reaches buttons @p1", () => {
    render(<VoteControls {...defaultProps} />);

    const bullBtn = screen.getByTestId("vote-bull-btn");
    const bearBtn = screen.getByTestId("vote-bear-btn");

    expect(bullBtn.tagName).toBe("BUTTON");
    expect(bearBtn.tagName).toBe("BUTTON");
    expect(bullBtn).not.toHaveAttribute("tabindex", "-1");
    expect(bearBtn).not.toHaveAttribute("tabindex", "-1");
  });

  test("[3-2-UNIT-VC12] aria-live region present @p0", () => {
    render(<VoteControls {...defaultProps} />);

    const region = screen.getByRole("region", { name: /vote on debate outcome/i });
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  test("[3-2-UNIT-VC13] disabled state communicates reason via aria-disabled @p1", () => {
    render(<VoteControls {...defaultProps} isFrozen={true} />);

    const bullBtn = screen.getByTestId("vote-bull-btn");
    expect(bullBtn).toHaveAttribute("aria-disabled", "true");
  });
});
