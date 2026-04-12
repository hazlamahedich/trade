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

  test("[3-2-UNIT-SR04] bar widths match percentages @p0", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 60, bear: 40 }}
        totalVotes={100}
      />,
    );

    const img = screen.getByRole("img");
    const bars = img.children;
    expect((bars[0] as HTMLElement).style.width).toBe("60%");
    expect((bars[1] as HTMLElement).style.width).toBe("40%");
  });

  test("[3-2-UNIT-SR05] zero-votes state — shows placeholder @p0", () => {
    render(<SentimentReveal voteBreakdown={null} totalVotes={0} />);

    expect(screen.getByText("No votes yet")).toBeInTheDocument();
    expect(screen.getByTestId("sentiment-reveal")).toBeInTheDocument();
  });

  test("[3-2-UNIT-SR06] tie state — both bars equal width @p1", () => {
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 50, bear: 50 }}
        totalVotes={100}
      />,
    );

    const img = screen.getByRole("img");
    const bars = img.children;
    expect((bars[0] as HTMLElement).style.width).toBe("50%");
    expect((bars[1] as HTMLElement).style.width).toBe("50%");
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

    expect(screen.getByText("Bull 50%")).toBeInTheDocument();
    expect(screen.getByText("Bear 50%")).toBeInTheDocument();
  });

  test("[3-2-UNIT-SR08] reduced motion — bar uses instant transition @p1", () => {
    mockUseReducedMotion.mockReturnValue(true);
    render(
      <SentimentReveal
        voteBreakdown={{ bull: 60, bear: 40 }}
        totalVotes={100}
      />,
    );

    const img = screen.getByRole("img");
    const bar = img.children[0] as HTMLElement;
    expect(bar.className).not.toContain("transition-all");
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
});
