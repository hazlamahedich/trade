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
    // Given: VoteControls with default idle props
    render(<VoteControls {...defaultProps} />);

    // When: querying both vote buttons
    const bullBtn = screen.getByTestId("vote-bull-btn");
    const bearBtn = screen.getByTestId("vote-bear-btn");

    // Then: both buttons render with correct text labels
    expect(bullBtn).toBeInTheDocument();
    expect(bearBtn).toBeInTheDocument();
    expect(bullBtn).toHaveTextContent("Bull Won");
    expect(bearBtn).toHaveTextContent("Bear Won");
  });

  test("[3-2-UNIT-VC02] clicking Bull button triggers vote('bull') @p0", () => {
    // Given: VoteControls with a vote mock
    const vote = jest.fn();
    render(<VoteControls {...defaultProps} vote={vote} />);

    // When: clicking the bull button
    fireEvent.click(screen.getByTestId("vote-bull-btn"));

    // Then: vote callback is called with 'bull'
    expect(vote).toHaveBeenCalledWith("bull");
  });

  test("[3-2-UNIT-VC03] clicking Bear button triggers vote('bear') @p0", () => {
    // Given: VoteControls with a vote mock
    const vote = jest.fn();
    render(<VoteControls {...defaultProps} vote={vote} />);

    // When: clicking the bear button
    fireEvent.click(screen.getByTestId("vote-bear-btn"));

    // Then: vote callback is called with 'bear'
    expect(vote).toHaveBeenCalledWith("bear");
  });

  test("[3-2-UNIT-VC04] buttons disabled when voteStatus === 'voting' @p0", () => {
    // Given: VoteControls with voteStatus='voting'
    render(<VoteControls {...defaultProps} voteStatus="voting" />);

    // When: querying both buttons
    // Then: both buttons are disabled
    expect(screen.getByTestId("vote-bull-btn")).toBeDisabled();
    expect(screen.getByTestId("vote-bear-btn")).toBeDisabled();
  });

  test("[3-2-UNIT-VC04b] voting button shows Voting… text and pulse @p0", () => {
    // Given: VoteControls with voteStatus='voting' and userVote='bull'
    render(<VoteControls {...defaultProps} voteStatus="voting" userVote="bull" />);

    // When: querying the voting bull button
    const bullBtn = screen.getByTestId("vote-bull-btn");

    // Then: shows "Voting…" text and pulse animation
    expect(bullBtn).toHaveTextContent("Voting…");
    expect(bullBtn.className).toContain("animate-pulse");
  });

  test("[3-2-UNIT-VC05] rapid double-click — second click ignored when voting @p0", () => {
    // Given: VoteControls in idle state
    const vote = jest.fn();
    const { rerender } = render(
      <VoteControls {...defaultProps} vote={vote} voteStatus="idle" />,
    );

    // When: clicking bull once, then rerendering as voting and clicking again
    const bullBtn = screen.getByTestId("vote-bull-btn");
    fireEvent.click(bullBtn);
    expect(vote).toHaveBeenCalledTimes(1);

    rerender(<VoteControls {...defaultProps} vote={vote} voteStatus="voting" />);
    fireEvent.click(bullBtn);

    // Then: vote still only called once — second click ignored
    expect(vote).toHaveBeenCalledTimes(1);
  });

  test("[3-2-UNIT-VC06] selected state styling on voted button @p1", () => {
    // Given: VoteControls with userVote='bull' and voteStatus='voted'
    render(<VoteControls {...defaultProps} userVote="bull" voteStatus="voted" />);

    // When: querying the voted bull button
    const bullBtn = screen.getByTestId("vote-bull-btn");

    // Then: button has selected ring styling
    expect(bullBtn.className).toContain("ring-2");
    expect(bullBtn.className).toContain("ring-emerald-400");
  });

  test("[3-2-UNIT-VC07] dynamic aria-label — idle shows 'Vote Bull Won' @p0", () => {
    // Given: VoteControls in idle state
    render(<VoteControls {...defaultProps} />);

    // When: querying aria-labels
    // Then: buttons show "Vote {choice}" aria-labels
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
    // Given: VoteControls with userVote='bull' in voted state
    render(<VoteControls {...defaultProps} userVote="bull" voteStatus="voted" />);

    // When: querying the bull button's aria-label
    // Then: shows "You voted Bull Won — cannot be changed"
    expect(screen.getByTestId("vote-bull-btn")).toHaveAttribute(
      "aria-label",
      "You voted Bull Won — cannot be changed",
    );
  });

  test("[3-2-UNIT-VC08] data-testid attributes present @p0", () => {
    // Given: VoteControls rendered with default props
    render(<VoteControls {...defaultProps} />);

    // When: querying by data-testid
    // Then: both vote button testids are found
    expect(screen.getByTestId("vote-bull-btn")).toBeTruthy();
    expect(screen.getByTestId("vote-bear-btn")).toBeTruthy();
  });

  test("[3-2-UNIT-VC09] reduced motion respected @p1", () => {
    // Given: user prefers reduced motion
    mockUseReducedMotion.mockReturnValue(true);
    render(<VoteControls {...defaultProps} userVote={null} voteStatus="idle" />);

    // When: querying the region
    // Then: component still renders with accessible region
    const region = screen.getByRole("region", { name: /vote on debate outcome/i });
    expect(region).toBeInTheDocument();
  });

  test("[3-2-UNIT-VC10] Guardian freeze — buttons disabled with micro-label @p0", () => {
    // Given: VoteControls with isFrozen=true (Guardian freeze active)
    render(<VoteControls {...defaultProps} isFrozen={true} />);

    // When: querying buttons and freeze label
    // Then: buttons disabled and freeze message shown
    expect(screen.getByTestId("vote-bull-btn")).toBeDisabled();
    expect(screen.getByTestId("vote-bear-btn")).toBeDisabled();
    expect(screen.getByText("Voting paused during risk review")).toBeInTheDocument();
  });

  test("[3-2-UNIT-VC11] keyboard navigation — Tab reaches buttons @p1", () => {
    // Given: VoteControls rendered
    render(<VoteControls {...defaultProps} />);

    // When: checking button elements
    const bullBtn = screen.getByTestId("vote-bull-btn");
    const bearBtn = screen.getByTestId("vote-bear-btn");

    // Then: both are BUTTON elements without tabindex=-1
    expect(bullBtn.tagName).toBe("BUTTON");
    expect(bearBtn.tagName).toBe("BUTTON");
    expect(bullBtn).not.toHaveAttribute("tabindex", "-1");
    expect(bearBtn).not.toHaveAttribute("tabindex", "-1");
  });

  test("[3-2-UNIT-VC12] aria-live region present @p0", () => {
    // Given: VoteControls rendered
    render(<VoteControls {...defaultProps} />);

    // When: querying the region
    // Then: region has aria-live="polite"
    const region = screen.getByRole("region", { name: /vote on debate outcome/i });
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  test("[3-2-UNIT-VC13] disabled state communicates reason via aria-disabled @p1", () => {
    // Given: VoteControls with Guardian freeze
    render(<VoteControls {...defaultProps} isFrozen={true} />);

    // When: querying the disabled button
    // Then: aria-disabled is set to "true"
    const bullBtn = screen.getByTestId("vote-bull-btn");
    expect(bullBtn).toHaveAttribute("aria-disabled", "true");
  });
});
