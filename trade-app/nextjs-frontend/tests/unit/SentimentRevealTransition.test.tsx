import { render, screen } from "@testing-library/react";
import { SentimentReveal } from "../../features/debate/components/SentimentReveal";
import { mockUseReducedMotion } from "../support/helpers/mock-framer-motion";

jest.mock("framer-motion", () => {
  const React = require("react");
  function createMotionComponent(domTag: string) {
    return React.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<HTMLElement>) => {
        const { initial: _i, animate, exit: _e, transition, layout: _l, layoutId: _lid, onAnimationComplete: _oac, ...rest } = props;
        const style = {
          ...(rest.style as Record<string, string> | undefined),
          ...(typeof animate === "object" && animate !== null ? animate : {}),
        };
        const extraProps: Record<string, unknown> = {};
        if (transition !== undefined) {
          extraProps["data-transition"] = JSON.stringify(transition);
        }
        return React.createElement(domTag, { ...rest, ...extraProps, style, ref });
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

describe("[3-4-UNIT] SentimentReveal Framer Motion transition props", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseReducedMotion.mockReturnValue(false);
  });

  function getTransitionFor(testId: string): Record<string, unknown> | undefined {
    const el = screen.getByTestId(testId);
    const raw = el.getAttribute("data-transition");
    return raw ? JSON.parse(raw) : undefined;
  }

  test("[3-4-UNIT-FM01] bull bar transition has duration 0.3 and easeOut @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 60, bear: 40 }}
        totalVotes={100}
      />,
    );

    const t = getTransitionFor("bull-bar");
    expect(t).toBeDefined();
    expect(t.duration).toBe(0.3);
    expect(t.ease).toBe("easeOut");
    expect(t.delay).toBeUndefined();
  });

  test("[3-4-UNIT-FM02] bear bar has stagger delay 0.15 on first render @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 60, bear: 40 }}
        totalVotes={100}
      />,
    );

    const t = getTransitionFor("bear-bar");
    expect(t).toBeDefined();
    expect(t.delay).toBe(0.15);
  });

  test("[3-4-UNIT-FM03] other bar has stagger delay 0.15 on first render @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 30, bear: 30, undecided: 40 }}
        totalVotes={100}
      />,
    );

    const t = getTransitionFor("other-bar");
    expect(t).toBeDefined();
    expect(t.delay).toBe(0.15);
  });

  test("[3-4-UNIT-FM04] bear bar stagger delay is 0 on subsequent render @p1", () => {
    const { rerender } = render(
      <SentimentReveal
        voteBreakdown={{ bull: 60, bear: 40 }}
        totalVotes={100}
      />,
    );

    rerender(
      <SentimentReveal
        voteBreakdown={{ bull: 55, bear: 45 }}
        totalVotes={100}
      />,
    );

    const t = getTransitionFor("bear-bar");
    expect(t).toBeDefined();
    expect(t.delay).toBe(0);
  });

  test("[3-4-UNIT-FM05] reduced motion: all bars have duration 0 @p0", () => {
    mockUseReducedMotion.mockReturnValue(true);

    render(
      <SentimentReveal
        voteBreakdown={{ bull: 60, bear: 40 }}
        totalVotes={100}
      />,
    );

    const bullT = getTransitionFor("bull-bar");
    const bearT = getTransitionFor("bear-bar");

    expect(bullT.duration).toBe(0);
    expect(bearT.duration).toBe(0);
    expect(bearT.delay).toBe(0);
  });

  test("[3-4-UNIT-FM06] reduced motion: other bar has duration 0 and delay 0 @p0", () => {
    mockUseReducedMotion.mockReturnValue(true);

    render(
      <SentimentReveal
        voteBreakdown={{ bull: 30, bear: 30, undecided: 40 }}
        totalVotes={100}
      />,
    );

    const t = getTransitionFor("other-bar");
    expect(t.duration).toBe(0);
    expect(t.delay).toBe(0);
  });
});
