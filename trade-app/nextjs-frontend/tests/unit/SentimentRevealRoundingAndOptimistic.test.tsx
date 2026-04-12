import { render, screen } from "@testing-library/react";
import { SentimentReveal } from "../../features/debate/components/SentimentReveal";
import { mockUseReducedMotion } from "../support/helpers/mock-framer-motion";

jest.mock("framer-motion", () => {
  const React = require("react"); // eslint-disable-line @typescript-eslint/no-require-imports
  function createMotionComponent(domTag: string) {
    return React.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<HTMLElement>) => {
        const {
          initial: _initial, animate, exit: _exit, transition: _transition,
          layout: _layout, layoutId: _layoutId, onAnimationComplete: _onAnimationComplete,
          ...rest
        } = props;
        void _initial; void _exit; void _transition; void _layout; void _layoutId; void _onAnimationComplete;
        const style = {
          ...(rest.style as Record<string, string> | undefined),
          ...(typeof animate === "object" && animate !== null ? animate : {}),
        };
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

describe("[3-5-1-UNIT] SentimentReveal rounding fix", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseReducedMotion.mockReturnValue(false);
  });

  test("[3-5-1-UNIT-RD01] percentages sum to 100 for 50/50 split @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 50, bear: 50 }}
        totalVotes={100}
      />,
    );
    expect(screen.getByText("Bull 50%")).toBeInTheDocument();
    expect(screen.getByText("Bear 50%")).toBeInTheDocument();
  });

  test("[3-5-1-UNIT-RD02] percentages sum to 100 for 99/1 split @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 99, bear: 1 }}
        totalVotes={100}
      />,
    );
    expect(screen.getByText("Bull 99%")).toBeInTheDocument();
    expect(screen.getByText("Bear 1%")).toBeInTheDocument();
  });

  test("[3-5-1-UNIT-RD03] percentages sum to 100 for 1/99 split @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 1, bear: 99 }}
        totalVotes={100}
      />,
    );
    expect(screen.getByText("Bull 1%")).toBeInTheDocument();
    expect(screen.getByText("Bear 99%")).toBeInTheDocument();
  });

  test("[3-5-1-UNIT-RD04] percentages sum to 100 for uneven 7 votes @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 5, bear: 2 }}
        totalVotes={7}
      />,
    );
    const bullLabel = screen.getByText(/Bull \d+%/);
    const bearLabel = screen.getByText(/Bear \d+%/);
    expect(bullLabel).toBeInTheDocument();
    expect(bearLabel).toBeInTheDocument();
    const bullMatch = bullLabel.textContent?.match(/(\d+)%/);
    const bearMatch = bearLabel.textContent?.match(/(\d+)%/);
    const bullVal = bullMatch ? parseInt(bullMatch[1], 10) : 0;
    const bearVal = bearMatch ? parseInt(bearMatch[1], 10) : 0;
    expect(bullVal + bearVal).toBe(100);
  });

  test("[3-5-1-UNIT-RD05] percentages sum to 100 with undecided votes @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 3, bear: 3, undecided: 1 }}
        totalVotes={7}
      />,
    );
    const bullLabel = screen.getByText(/Bull \d+%/);
    const bearLabel = screen.getByText(/Bear \d+%/);
    const bullMatch = bullLabel.textContent?.match(/(\d+)%/);
    const bearMatch = bearLabel.textContent?.match(/(\d+)%/);
    const bullVal = bullMatch ? parseInt(bullMatch[1], 10) : 0;
    const bearVal = bearMatch ? parseInt(bearMatch[1], 10) : 0;
    expect(bullVal + bearVal).toBeLessThanOrEqual(100);
  });

  test("[3-5-1-UNIT-RD06] 100/0 extreme split @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 10, bear: 0 }}
        totalVotes={10}
      />,
    );
    expect(screen.getByText("Bull 100%")).toBeInTheDocument();
    expect(screen.getByText("Bear 0%")).toBeInTheDocument();
  });

  test("[3-5-1-UNIT-RD07] 0/100 extreme split @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 0, bear: 10 }}
        totalVotes={10}
      />,
    );
    expect(screen.getByText("Bull 0%")).toBeInTheDocument();
    expect(screen.getByText("Bear 100%")).toBeInTheDocument();
  });
});

describe("[3-5-3-UNIT] SentimentReveal optimistic state", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseReducedMotion.mockReturnValue(false);
  });

  test("[3-5-3-UNIT-OPT01] optimistic bull segment shows shimmer @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 5, bear: 3 }}
        totalVotes={8}
        optimisticSegment="bull"
        optimisticStatus="pending"
      />,
    );
    expect(screen.getByTestId("bull-bar-shimmer")).toBeInTheDocument();
    expect(screen.queryByTestId("bear-bar-shimmer")).not.toBeInTheDocument();
  });

  test("[3-5-3-UNIT-OPT02] optimistic bear segment shows shimmer @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 3, bear: 5 }}
        totalVotes={8}
        optimisticSegment="bear"
        optimisticStatus="pending"
      />,
    );
    expect(screen.getByTestId("bear-bar-shimmer")).toBeInTheDocument();
    expect(screen.queryByTestId("bull-bar-shimmer")).not.toBeInTheDocument();
  });

  test("[3-5-3-UNIT-OPT03] confirmed status hides shimmer @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 5, bear: 3 }}
        totalVotes={8}
        optimisticSegment="bull"
        optimisticStatus="confirmed"
      />,
    );
    expect(screen.queryByTestId("bull-bar-shimmer")).not.toBeInTheDocument();
  });

  test("[3-5-3-UNIT-OPT04] failed status hides shimmer @p1", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 5, bear: 3 }}
        totalVotes={8}
        optimisticSegment="bull"
        optimisticStatus="failed"
      />,
    );
    expect(screen.queryByTestId("bull-bar-shimmer")).not.toBeInTheDocument();
  });

  test("[3-5-3-UNIT-OPT05] reduced motion hides shimmer on pending @p0", () => {
    mockUseReducedMotion.mockReturnValue(true);
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 5, bear: 3 }}
        totalVotes={8}
        optimisticSegment="bull"
        optimisticStatus="pending"
      />,
    );
    expect(screen.queryByTestId("bull-bar-shimmer")).not.toBeInTheDocument();
  });

  test("[3-5-3-UNIT-OPT06] aria-label reflects pending status @p1", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 5, bear: 3 }}
        totalVotes={8}
        optimisticSegment="bull"
        optimisticStatus="pending"
      />,
    );
    const region = screen.getByTestId("sentiment-reveal");
    expect(region).toHaveAttribute("aria-label", "Your vote is being recorded");
  });

  test("[3-5-3-UNIT-OPT07] aria-label reflects timeout status @p1", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 5, bear: 3 }}
        totalVotes={8}
        optimisticSegment="bull"
        optimisticStatus="timeout"
      />,
    );
    const region = screen.getByTestId("sentiment-reveal");
    expect(region).toHaveAttribute("aria-label", "Your vote is still being processed");
  });

  test("[3-5-3-UNIT-OPT08] no optimistic props renders normally @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 5, bear: 3 }}
        totalVotes={8}
      />,
    );
    expect(screen.queryByTestId("bull-bar-shimmer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("bear-bar-shimmer")).not.toBeInTheDocument();
    const region = screen.getByTestId("sentiment-reveal");
    expect(region).toHaveAttribute("aria-label", "Bull: 63%, Bear: 37%");
  });
});
