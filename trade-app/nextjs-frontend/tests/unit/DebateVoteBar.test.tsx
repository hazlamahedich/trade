import { render, screen } from "@testing-library/react";
import { DebateVoteBar } from "@/features/debate/components/DebateVoteBar";

describe("DebateVoteBar", () => {
  it("renders correct percentages for 50/50 split", () => {
    render(<DebateVoteBar bullVotes={50} bearVotes={50} />);
    expect(screen.getByText("Bull 50%")).toBeInTheDocument();
    expect(screen.getByText("Bear 50%")).toBeInTheDocument();
  });

  it("renders correct percentages for 99/1 split", () => {
    render(<DebateVoteBar bullVotes={99} bearVotes={1} />);
    expect(screen.getByText("Bull 99%")).toBeInTheDocument();
    expect(screen.getByText("Bear 1%")).toBeInTheDocument();
  });

  it("renders correct percentages for 0/100 split", () => {
    render(<DebateVoteBar bullVotes={0} bearVotes={100} />);
    expect(screen.getByText("Bull 0%")).toBeInTheDocument();
    expect(screen.getByText("Bear 100%")).toBeInTheDocument();
  });

  it("renders No votes for 0/0", () => {
    render(<DebateVoteBar bullVotes={0} bearVotes={0} />);
    expect(screen.getByText("No votes")).toBeInTheDocument();
  });

  it("percentages always sum to 100", () => {
    const { container } = render(
      <DebateVoteBar bullVotes={33} bearVotes={67} />,
    );
    const bullText = screen.getByText(/Bull/);
    const bearText = screen.getByText(/Bear/);
    const bullMatch = bullText.textContent?.match(/(\d+)%/);
    const bearMatch = bearText.textContent?.match(/(\d+)%/);
    const bullPct = parseInt(bullMatch?.[1] ?? "0");
    const bearPct = parseInt(bearMatch?.[1] ?? "0");
    expect(bullPct + bearPct).toBe(100);
  });

  it("has aria-label with percentages", () => {
    render(<DebateVoteBar bullVotes={60} bearVotes={40} />);
    const bar = screen.getByLabelText("Bull: 60%, Bear: 40%");
    expect(bar).toBeInTheDocument();
  });

  it("has aria-label for no votes state", () => {
    render(<DebateVoteBar bullVotes={0} bearVotes={0} />);
    expect(screen.getByLabelText("No votes yet")).toBeInTheDocument();
  });

  it("uses custom labels when provided", () => {
    render(
      <DebateVoteBar bullVotes={75} bearVotes={25} bullLabel="Long" bearLabel="Short" />,
    );
    expect(screen.getByText("Long 75%")).toBeInTheDocument();
    expect(screen.getByText("Short 25%")).toBeInTheDocument();
  });
});
