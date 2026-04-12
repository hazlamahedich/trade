import { render, screen } from "@testing-library/react";
import { SentimentReveal } from "../../features/debate/components/SentimentReveal";

const mockUseReducedMotion = jest.fn(() => false);
jest.mock("framer-motion", () => {
  const React = require("react");
  return {
    ...jest.requireActual("framer-motion"),
    useReducedMotion: () => mockUseReducedMotion(),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: {
      div: React.forwardRef(
        (props: Record<string, unknown>, ref: React.Ref<HTMLDivElement>) => {
          const {
            initial: _i,
            animate,
            exit: _e,
            transition: _t,
            layout: _l,
            layoutId: _lid,
            onAnimationComplete: _oac,
            ...rest
          } = props;
          const style = {
            ...(rest.style as Record<string, string> | undefined),
            ...(typeof animate === "object" && animate !== null ? animate : {}),
          };
          return React.createElement("div", { ...rest, style, ref });
        },
      ),
      span: React.forwardRef(
        (props: Record<string, unknown>, ref: React.Ref<HTMLSpanElement>) => {
          const {
            initial: _i,
            animate,
            exit: _e,
            transition: _t,
            ...rest
          } = props;
          const style = {
            ...(rest.style as Record<string, string> | undefined),
            ...(typeof animate === "object" && animate !== null ? animate : {}),
          };
          return React.createElement("span", { ...rest, style, ref });
        },
      ),
    },
  };
});

describe("[3-2-UNIT] SentimentReveal Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseReducedMotion.mockReturnValue(false);
  });

  test("[3-2-UNIT-SR01] renders vote percentages in bar @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 70, bear: 30 }}
        totalVotes={100}
      />,
    );

    expect(screen.getByText("Bull 70%")).toBeInTheDocument();
    expect(screen.getByText("Bear 30%")).toBeInTheDocument();
  });

  test("[3-2-UNIT-SR02] renders total vote count @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 70, bear: 30 }}
        totalVotes={100}
      />,
    );

    expect(screen.getByText("100 votes")).toBeInTheDocument();
  });

  test("[3-2-UNIT-SR03] aria-label contains correct percentages @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 70, bear: 30 }}
        totalVotes={100}
      />,
    );

    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("aria-label", "Bull: 70%, Bear: 30%");
  });

  test("[3-2-UNIT-SR03b] aria-label includes Other when undecided votes present @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 30, bear: 30, undecided: 40 }}
        totalVotes={100}
      />,
    );

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("aria-label", "Bull: 30%, Bear: 30%, Other: 40%");
  });

  test("[3-2-UNIT-SR04] bar widths match percentages @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 60, bear: 40 }}
        totalVotes={100}
      />,
    );

    const bullBar = screen.getByTestId("bull-bar");
    const bearBar = screen.getByTestId("bear-bar");
    expect(bullBar).toHaveStyle({ width: "60%" });
    expect(bearBar).toHaveStyle({ width: "40%" });
    expect(screen.queryByTestId("other-bar")).not.toBeInTheDocument();
  });

  test("[3-2-UNIT-SR04b] bar includes gray segment for other votes @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 30, bear: 30, undecided: 40 }}
        totalVotes={100}
      />,
    );

    const bullBar = screen.getByTestId("bull-bar");
    const otherBar = screen.getByTestId("other-bar");
    const bearBar = screen.getByTestId("bear-bar");

    expect(bullBar).toHaveStyle({ width: "30%" });
    expect(otherBar).toHaveStyle({ width: "40%" });
    expect(otherBar.className).toContain("bg-slate-500");
    expect(bearBar).toHaveStyle({ width: "30%" });
  });

  test("[3-2-UNIT-SR05] zero-votes state — shows placeholder @p0", () => {
    render(<SentimentReveal voteBreakdown={null} totalVotes={0} />);

    expect(screen.getByTestId("sentiment-empty-state")).toHaveTextContent(
      "Be the first to vote",
    );
    expect(screen.getByTestId("sentiment-reveal")).toBeInTheDocument();
  });

  test("[3-2-UNIT-SR06] tie state — both bars equal width @p1", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 50, bear: 50 }}
        totalVotes={100}
      />,
    );

    const bullBar = screen.getByTestId("bull-bar");
    const bearBar = screen.getByTestId("bear-bar");
    expect(bullBar).toHaveStyle({ width: "50%" });
    expect(bearBar).toHaveStyle({ width: "50%" });
  });

  test("[3-2-UNIT-SR07] extreme ratio — both sides have text labels @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 99, bear: 1 }}
        totalVotes={100}
      />,
    );

    expect(screen.getByText("Bull 99%")).toBeInTheDocument();
    expect(screen.getByText("Bear 1%")).toBeInTheDocument();
  });

  test("[3-2-UNIT-SR07b] undecided votes don't inflate bear percentage @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 3, bear: 3, undecided: 4 }}
        totalVotes={10}
      />,
    );

    expect(screen.getByText("Bull 30%")).toBeInTheDocument();
    expect(screen.getByText("Bear 30%")).toBeInTheDocument();
    const otherBar = screen.getByTestId("other-bar");
    expect(otherBar).toHaveStyle({ width: "40%" });
  });

  test("[3-2-UNIT-SR07c] all-undecided votes — no 100% Bear false positive @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ undecided: 5 }}
        totalVotes={5}
      />,
    );

    expect(screen.getByText("Bull 0%")).toBeInTheDocument();
    expect(screen.getByText("Bear 0%")).toBeInTheDocument();
    const bullBar = screen.getByTestId("bull-bar");
    const otherBar = screen.getByTestId("other-bar");
    const bearBar = screen.getByTestId("bear-bar");
    expect(bullBar).toHaveStyle({ width: "0%" });
    expect(otherBar.className).toContain("bg-slate-500");
    expect(otherBar).toHaveStyle({ width: "100%" });
    expect(bearBar).toHaveStyle({ width: "0%" });
  });

  test("[3-2-UNIT-SR08] reduced motion — bars rendered without transition class @p1", () => {
    mockUseReducedMotion.mockReturnValue(true);
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 60, bear: 40 }}
        totalVotes={100}
      />,
    );

    const bullBar = screen.getByTestId("bull-bar");
    expect(bullBar.className).not.toContain("transition-all");
  });

  test("[3-2-UNIT-SR09] aria-live='polite' container present @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 60, bear: 40 }}
        totalVotes={100}
      />,
    );

    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  test("[3-2-UNIT-SR10] container has tabIndex for focus management @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 60, bear: 40 }}
        totalVotes={100}
      />,
    );

    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("tabindex", "-1");
  });

  test("[3-4-UNIT-SR11] rerender with new percentages updates bar widths @p0", () => {
    const { rerender } = render(
      <SentimentReveal
        voteBreakdown={{ bull: 60, bear: 40 }}
        totalVotes={100}
      />,
    );

    expect(screen.getByTestId("bull-bar")).toHaveStyle({ width: "60%" });

    rerender(
      <SentimentReveal
        voteBreakdown={{ bull: 50, bear: 50 }}
        totalVotes={100}
      />,
    );

    expect(screen.getByTestId("bull-bar")).toHaveStyle({ width: "50%" });
    expect(screen.getByTestId("bear-bar")).toHaveStyle({ width: "50%" });
  });
});
