import { render, screen } from "@testing-library/react";
import { DebateVoteBar } from "@/features/debate/components/DebateVoteBar";

describe("DebateVoteBar", () => {
  it("[P0] renders correct percentages for 50/50 split", () => {
    render(<DebateVoteBar bullVotes={50} bearVotes={50} />);
    expect(screen.getByText("Bull 50%")).toBeInTheDocument();
    expect(screen.getByText("Bear 50%")).toBeInTheDocument();
  });

  it("[P0] renders correct percentages for 99/1 split", () => {
    render(<DebateVoteBar bullVotes={99} bearVotes={1} />);
    expect(screen.getByText("Bull 99%")).toBeInTheDocument();
    expect(screen.getByText("Bear 1%")).toBeInTheDocument();
  });

  it("[P0] renders correct percentages for 0/100 split", () => {
    render(<DebateVoteBar bullVotes={0} bearVotes={100} />);
    expect(screen.getByText("Bull 0%")).toBeInTheDocument();
    expect(screen.getByText("Bear 100%")).toBeInTheDocument();
  });

  it("[P0] renders No votes for 0/0/0", () => {
    render(<DebateVoteBar bullVotes={0} bearVotes={0} />);
    expect(screen.getByText("No votes")).toBeInTheDocument();
  });

  it("[P0] percentages always sum to 100 with undecided", () => {
    render(
      <DebateVoteBar bullVotes={30} bearVotes={20} undecidedVotes={50} />,
    );
    const bullText = screen.getByText(/Bull/);
    const bearText = screen.getByText(/Bear/);
    const undecidedText = screen.getByText(/Undecided/);
    const bullPct = parseInt(bullText.textContent?.match(/(\d+)%/)?.[1] ?? "0");
    const bearPct = parseInt(bearText.textContent?.match(/(\d+)%/)?.[1] ?? "0");
    const undPct = parseInt(undecidedText.textContent?.match(/(\d+)%/)?.[1] ?? "0");
    expect(bullPct + bearPct + undPct).toBe(100);
  });

  it("[P0] percentages always sum to 100 without undecided", () => {
    render(<DebateVoteBar bullVotes={33} bearVotes={67} />);
    const bullText = screen.getByText(/Bull/);
    const bearText = screen.getByText(/Bear/);
    const bullPct = parseInt(bullText.textContent?.match(/(\d+)%/)?.[1] ?? "0");
    const bearPct = parseInt(bearText.textContent?.match(/(\d+)%/)?.[1] ?? "0");
    expect(bullPct + bearPct).toBe(100);
  });

  it("[P0] has aria-label with all three percentages", () => {
    render(<DebateVoteBar bullVotes={60} bearVotes={30} undecidedVotes={10} />);
    const bar = screen.getByLabelText("Bull: 60%, Bear: 30%, Undecided: 10%");
    expect(bar).toBeInTheDocument();
  });

  it("[P0] has aria-label for no votes state", () => {
    render(<DebateVoteBar bullVotes={0} bearVotes={0} />);
    expect(screen.getByLabelText("No votes yet")).toBeInTheDocument();
  });

  it("[P1] uses custom labels when provided", () => {
    render(
      <DebateVoteBar bullVotes={75} bearVotes={25} bullLabel="Long" bearLabel="Short" />,
    );
    expect(screen.getByText("Long 75%")).toBeInTheDocument();
    expect(screen.getByText("Short 25%")).toBeInTheDocument();
  });

  it("[P1] hides undecided label when zero undecided votes", () => {
    render(<DebateVoteBar bullVotes={60} bearVotes={40} undecidedVotes={0} />);
    expect(screen.queryByText(/Undecided/)).not.toBeInTheDocument();
  });

  it("[P1] applies motion-reduce:transition-none for reduced motion", () => {
    const { container } = render(
      <DebateVoteBar bullVotes={60} bearVotes={30} undecidedVotes={10} />,
    );
    const motionBars = container.querySelectorAll(
      ".motion-reduce\\:transition-none",
    );
    expect(motionBars.length).toBe(3);
  });

  it("[P2] passes className prop to container", () => {
    const { container } = render(
      <DebateVoteBar bullVotes={50} bearVotes={50} className="my-custom-class" />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("my-custom-class");
  });
});
