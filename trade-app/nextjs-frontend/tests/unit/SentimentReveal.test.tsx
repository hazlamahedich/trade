import { render, screen } from "@testing-library/react";
import { SentimentReveal } from "../../features/debate/components/SentimentReveal";

const mockUseReducedMotion = jest.fn(() => false);
jest.mock("framer-motion", () => ({
  ...jest.requireActual("framer-motion"),
  useReducedMotion: () => mockUseReducedMotion(),
}));

describe("[3-2-UNIT] SentimentReveal Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseReducedMotion.mockReturnValue(false);
  });

  test("[3-2-UNIT-SR01] renders vote percentages in bar @p0", () => {
    // Given: a 70/30 bull/bear split with 100 total votes
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 70, bear: 30 }}
        totalVotes={100}
      />,
    );

    // When: querying percentage text
    // Then: "Bull 70%" and "Bear 30%" are rendered
    expect(screen.getByText("Bull 70%")).toBeInTheDocument();
    expect(screen.getByText("Bear 30%")).toBeInTheDocument();
  });

  test("[3-2-UNIT-SR02] renders total vote count @p0", () => {
    // Given: a 70/30 split with 100 total votes
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 70, bear: 30 }}
        totalVotes={100}
      />,
    );

    // When: querying total count text
    // Then: "100 votes" is displayed
    expect(screen.getByText("100 votes")).toBeInTheDocument();
  });

  test("[3-2-UNIT-SR03] aria-label contains correct percentages @p0", () => {
    // Given: a 70/30 split
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 70, bear: 30 }}
        totalVotes={100}
      />,
    );

    // When: querying the region's aria-label
    // Then: label contains "Bull: 70%, Bear: 30%"
    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("aria-label", "Bull: 70%, Bear: 30%");
  });

  test("[3-2-UNIT-SR03b] aria-label includes Other when undecided votes present @p0", () => {
    // Given: a 30/30/40 bull/bear/undecided split
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 30, bear: 30, undecided: 40 }}
        totalVotes={100}
      />,
    );

    // When: querying the bar's aria-label
    // Then: label includes Other percentage
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("aria-label", "Bull: 30%, Bear: 30%, Other: 40%");
  });

  test("[3-2-UNIT-SR04] bar widths match percentages @p0", () => {
    // Given: a 60/40 split
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 60, bear: 40 }}
        totalVotes={100}
      />,
    );

    // When: querying bar elements
    const img = screen.getByRole("img");
    const bars = img.children;

    // Then: first bar is 60% width, last is 40% (no other segment)
    expect((bars[0] as HTMLElement).style.width).toBe("60%");
    expect((bars[bars.length - 1] as HTMLElement).style.width).toBe("40%");
    expect(bars.length).toBe(2);
  });

  test("[3-2-UNIT-SR04b] bar includes gray segment for other votes @p0", () => {
    // Given: a 30/30/40 split with undecided votes
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 30, bear: 30, undecided: 40 }}
        totalVotes={100}
      />,
    );

    // When: querying bar elements
    const img = screen.getByRole("img");
    const bars = img.children;

    // Then: three segments — bull 30%, other 40%, bear 30%
    expect(bars.length).toBe(3);
    expect((bars[0] as HTMLElement).style.width).toBe("30%");
    expect((bars[1] as HTMLElement).className).toContain("bg-slate-500");
    expect((bars[1] as HTMLElement).style.width).toBe("40%");
    expect((bars[2] as HTMLElement).style.width).toBe("30%");
  });

  test("[3-2-UNIT-SR05] zero-votes state — shows placeholder @p0", () => {
    // Given: null voteBreakdown and 0 total votes
    render(<SentimentReveal voteBreakdown={null} totalVotes={0} />);

    // When: querying for placeholder text and container
    // Then: "No votes yet" is shown and sentiment-reveal container exists
    expect(screen.getByText("No votes yet")).toBeInTheDocument();
    expect(screen.getByTestId("sentiment-reveal")).toBeInTheDocument();
  });

  test("[3-2-UNIT-SR06] tie state — both bars equal width @p1", () => {
    // Given: a 50/50 tie
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 50, bear: 50 }}
        totalVotes={100}
      />,
    );

    // When: querying bar elements
    const img = screen.getByRole("img");
    const bars = img.children;

    // Then: both bars are 50% width
    expect((bars[0] as HTMLElement).style.width).toBe("50%");
    expect((bars[bars.length - 1] as HTMLElement).style.width).toBe("50%");
  });

  test("[3-2-UNIT-SR07] extreme ratio — both sides have text labels @p0", () => {
    // Given: a 99/1 extreme ratio
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 99, bear: 1 }}
        totalVotes={100}
      />,
    );

    // When: querying percentage labels
    // Then: both sides still render text (no hidden labels)
    expect(screen.getByText("Bull 99%")).toBeInTheDocument();
    expect(screen.getByText("Bear 1%")).toBeInTheDocument();
  });

  test("[3-2-UNIT-SR07b] undecided votes don't inflate bear percentage @p0", () => {
    // Given: 3 bull, 3 bear, 4 undecided votes
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 3, bear: 3, undecided: 4 }}
        totalVotes={10}
      />,
    );

    // When: querying percentage labels
    // Then: bull and bear each at 30%, other segment at 40%
    expect(screen.getByText("Bull 30%")).toBeInTheDocument();
    expect(screen.getByText("Bear 30%")).toBeInTheDocument();
    const img = screen.getByRole("img");
    const bars = img.children;
    expect(bars.length).toBe(3);
    expect((bars[1] as HTMLElement).style.width).toBe("40%");
  });

  test("[3-2-UNIT-SR07c] all-undecided votes — no 100% Bear false positive @p0", () => {
    // Given: 0 bull, 0 bear, 5 undecided votes
    render(
      <SentimentReveal
        voteBreakdown={{ undecided: 5 }}
        totalVotes={5}
      />,
    );

    // When: querying percentage labels
    // Then: bull and bear both 0%, gray segment is 100%
    expect(screen.getByText("Bull 0%")).toBeInTheDocument();
    expect(screen.getByText("Bear 0%")).toBeInTheDocument();
    const img = screen.getByRole("img");
    const bars = img.children;
    expect(bars.length).toBe(3);
    expect((bars[0] as HTMLElement).style.width).toBe("0%");
    expect((bars[1] as HTMLElement).className).toContain("bg-slate-500");
    expect((bars[1] as HTMLElement).style.width).toBe("100%");
    expect((bars[2] as HTMLElement).style.width).toBe("0%");
  });

  test("[3-2-UNIT-SR08] reduced motion — bar uses instant transition @p1", () => {
    // Given: user prefers reduced motion
    mockUseReducedMotion.mockReturnValue(true);
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 60, bear: 40 }}
        totalVotes={100}
      />,
    );

    // When: querying the bar element
    const img = screen.getByRole("img");
    const bar = img.children[0] as HTMLElement;

    // Then: bar does not use transition-all animation
    expect(bar.className).not.toContain("transition-all");
  });

  test("[3-2-UNIT-SR09] aria-live='polite' container present @p0", () => {
    // Given: SentimentReveal rendered with vote data
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 60, bear: 40 }}
        totalVotes={100}
      />,
    );

    // When: querying the region
    // Then: region has aria-live="polite"
    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  test("[3-2-UNIT-SR10] container has tabIndex for focus management @p0", () => {
    // Given: SentimentReveal rendered
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 60, bear: 40 }}
        totalVotes={100}
      />,
    );

    // When: querying the region
    // Then: region has tabindex="-1" for programmatic focus
    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("tabindex", "-1");
  });
});
