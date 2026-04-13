import { render, screen, act } from "@testing-library/react";
import { SentimentReveal } from "../../features/debate/components/SentimentReveal";
import { mockUseReducedMotion } from "../support/helpers/mock-framer-motion";

jest.mock("framer-motion", () => {
  const React = require("react");
  function createMotionComponent(domTag: string) {
    return React.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<HTMLElement>) => {
        const animate = props.animate;
        const style = {
          ...(props.style as Record<string, string> | undefined),
          ...(typeof animate === "object" && animate !== null ? animate : {}),
        };
        const { initial, exit, transition, layout, layoutId, onAnimationComplete, ...rest } = props;
        void initial; void exit; void transition; void layout; void layoutId; void onAnimationComplete;
        return React.createElement(domTag, { ...rest, style, ref });
      },
    );
  }
  return {
    ...jest.requireActual("framer-motion"),
    useReducedMotion: () => mockUseReducedMotion(),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: { div: createMotionComponent("div"), span: createMotionComponent("span") },
  };
});

describe("[3-6-UNIT] SentimentReveal First Voter Celebration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockUseReducedMotion.mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("[3-6-UNIT-SRC01] first voter celebration shows badge with neutral amber color @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 1, bear: 0 }}
        totalVotes={1}
        isFirstVoter={true}
        debateId="debate-1"
      />
    );

    const badge = screen.getByTestId("first-voter-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("First vote cast");
    expect(badge.className).toContain("bg-amber-500/15");
    expect(badge.className).toContain("text-amber-300");
  });

  test("[3-6-UNIT-SRC02] celebration auto-dismisses after timeout @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 1, bear: 0 }}
        totalVotes={1}
        isFirstVoter={true}
        debateId="debate-2"
      />
    );

    expect(screen.getByTestId("first-voter-badge")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(screen.queryByTestId("first-voter-badge")).not.toBeInTheDocument();
  });

  test("[3-6-UNIT-SRC03] reduced motion — gentle opacity fade only @p0", () => {
    mockUseReducedMotion.mockReturnValue(true);

    render(
      <SentimentReveal
        voteBreakdown={{ bull: 1, bear: 0 }}
        totalVotes={1}
        isFirstVoter={true}
        debateId="debate-3"
      />
    );

    const badge = screen.getByTestId("first-voter-badge");
    expect(badge).toBeInTheDocument();
  });

  test("[3-6-UNIT-SRC04] reduced motion still dismisses after timeout @p0", () => {
    mockUseReducedMotion.mockReturnValue(true);

    render(
      <SentimentReveal
        voteBreakdown={{ bull: 1, bear: 0 }}
        totalVotes={1}
        isFirstVoter={true}
        debateId="debate-4"
      />
    );

    expect(screen.getByTestId("first-voter-badge")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(screen.queryByTestId("first-voter-badge")).not.toBeInTheDocument();
  });

  test("[3-6-UNIT-SRC05] no celebration when not first voter @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 5, bear: 3 }}
        totalVotes={8}
        isFirstVoter={false}
        debateId="debate-5"
      />
    );

    expect(screen.queryByTestId("first-voter-badge")).not.toBeInTheDocument();
  });

  test("[3-6-UNIT-SRC06] no celebration when isFirstVoter but totalVotes > 1 @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 5, bear: 3 }}
        totalVotes={8}
        isFirstVoter={true}
        debateId="debate-6"
      />
    );

    expect(screen.queryByTestId("first-voter-badge")).not.toBeInTheDocument();
  });

  test("[3-6-UNIT-SRC07] screen reader announces first vote and clears after dismiss @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 1, bear: 0 }}
        totalVotes={1}
        isFirstVoter={true}
        debateId="debate-7"
      />
    );

    const announcement = screen.getByText("You are the first to vote!");
    expect(announcement).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(screen.queryByText("You are the first to vote!")).not.toBeInTheDocument();
  });

  test("[3-6-UNIT-SRC08] celebration cleanup on unmount no state leaks @p0", () => {
    const { unmount } = render(
      <SentimentReveal
        voteBreakdown={{ bull: 1, bear: 0 }}
        totalVotes={1}
        isFirstVoter={true}
        debateId="debate-8"
      />
    );

    expect(screen.getByTestId("first-voter-badge")).toBeInTheDocument();

    unmount();

    act(() => {
      jest.advanceTimersByTime(3000);
    });
  });

  test("[3-6-UNIT-SRC09] celebration fires with 500ms delay from vote confirmation @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 1, bear: 0 }}
        totalVotes={1}
        isFirstVoter={true}
        debateId="debate-9"
      />
    );

    const badge = screen.getByTestId("first-voter-badge");
    expect(badge).toBeInTheDocument();
  });

  test("[3-6-UNIT-SRC10] full first voter flow — vote triggers celebration and auto-dismisses @p0", () => {
    const { rerender } = render(
      <SentimentReveal
        voteBreakdown={null}
        totalVotes={0}
        isFirstVoter={false}
        debateId="debate-10"
      />
    );

    expect(screen.queryByTestId("first-voter-badge")).not.toBeInTheDocument();

    rerender(
      <SentimentReveal
        voteBreakdown={{ bull: 1, bear: 0 }}
        totalVotes={1}
        isFirstVoter={true}
        debateId="debate-10"
      />
    );

    expect(screen.getByTestId("first-voter-badge")).toBeInTheDocument();
    expect(screen.getByText("You are the first to vote!")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(screen.queryByTestId("first-voter-badge")).not.toBeInTheDocument();
    expect(screen.queryByText("You are the first to vote!")).not.toBeInTheDocument();
  });

  test("[3-6-UNIT-SRC11] badge does not replay on remount for same debate @p0", () => {
    const debateId = "debate-replay-test";

    const { unmount } = render(
      <SentimentReveal
        voteBreakdown={{ bull: 1, bear: 0 }}
        totalVotes={1}
        isFirstVoter={true}
        debateId={debateId}
      />
    );

    expect(screen.getByTestId("first-voter-badge")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    unmount();

    render(
      <SentimentReveal
        voteBreakdown={{ bull: 1, bear: 0 }}
        totalVotes={1}
        isFirstVoter={true}
        debateId={debateId}
      />
    );

    expect(screen.queryByTestId("first-voter-badge")).not.toBeInTheDocument();
  });

  test("[3-6-UNIT-SRC12] no badge when debateId is undefined @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 1, bear: 0 }}
        totalVotes={1}
        isFirstVoter={true}
      />
    );

    expect(screen.queryByTestId("first-voter-badge")).not.toBeInTheDocument();
  });

  test("[3-6-UNIT-SRC13] aria-label shows pending status text @p1", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 1, bear: 0 }}
        totalVotes={1}
        optimisticSegment="bull"
        optimisticStatus="pending"
        isFirstVoter={false}
        debateId="debate-aria-pending"
      />
    );

    expect(screen.getByTestId("sentiment-reveal")).toHaveAttribute(
      "aria-label",
      "Your vote is being recorded"
    );
  });

  test("[3-6-UNIT-SRC14] aria-label shows failed status text @p1", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 1, bear: 0 }}
        totalVotes={1}
        optimisticSegment="bull"
        optimisticStatus="failed"
        isFirstVoter={false}
        debateId="debate-aria-failed"
      />
    );

    expect(screen.getByTestId("sentiment-reveal")).toHaveAttribute(
      "aria-label",
      "Your vote was updated"
    );
  });

  test("[3-6-UNIT-SRC15] aria-label shows timeout status text @p1", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 1, bear: 0 }}
        totalVotes={1}
        optimisticSegment="bull"
        optimisticStatus="timeout"
        isFirstVoter={false}
        debateId="debate-aria-timeout"
      />
    );

    expect(screen.getByTestId("sentiment-reveal")).toHaveAttribute(
      "aria-label",
      "Your vote is still being processed"
    );
  });

  test("[3-6-UNIT-SRC16] bar opacity is 0.6 for timeout optimistic status @p1", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 1, bear: 0 }}
        totalVotes={1}
        optimisticSegment="bull"
        optimisticStatus="timeout"
        isFirstVoter={false}
        debateId="debate-opacity-timeout"
      />
    );

    const bullBar = screen.getByTestId("bull-bar");
    expect(bullBar).toHaveStyle({ opacity: 0.6 });
  });

  test("[3-6-UNIT-SRC17] bar opacity is 0.85 for pending optimistic status @p1", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 1, bear: 0 }}
        totalVotes={1}
        optimisticSegment="bull"
        optimisticStatus="pending"
        isFirstVoter={false}
        debateId="debate-opacity-pending"
      />
    );

    const bullBar = screen.getByTestId("bull-bar");
    expect(bullBar).toHaveStyle({ opacity: 0.85 });
  });

  test("[3-6-UNIT-SRC18] bar opacity is 1 for confirmed optimistic status @p1", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 1, bear: 0 }}
        totalVotes={1}
        optimisticSegment="bull"
        optimisticStatus="confirmed"
        isFirstVoter={false}
        debateId="debate-opacity-confirmed"
      />
    );

    const bullBar = screen.getByTestId("bull-bar");
    expect(bullBar).toHaveStyle({ opacity: 1 });
  });
});
