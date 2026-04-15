import { render, screen } from "@testing-library/react";
import { DebateTranscript } from "@/features/debate/components/DebateTranscript";
import { ArchivedBadge } from "@/features/debate/components/ArchivedBadge";
import { createMockTranscriptMessage } from "./factories/debate-detail-factory";

describe("ArchivedBadge", () => {
  it("[P1][4.3-034] given no winner prop, renders 'Completed Debate' text", () => {
    render(<ArchivedBadge />);
    expect(screen.getByText("Completed Debate")).toBeInTheDocument();
  });

  it("[P1][4.3-035] given 'bull' winner, renders badge with winner context", () => {
    render(<ArchivedBadge winner="bull" />);
    expect(screen.getByText(/Completed Debate — Bull Wins/)).toBeInTheDocument();
  });

  it("[P1][4.3-036] given no winner, renders correct aria-label for ended debate", () => {
    render(<ArchivedBadge />);
    const badge = screen.getByText("Completed Debate").closest("[aria-label]");
    expect(badge).toHaveAttribute(
      "aria-label",
      "This debate has ended. Final verdict available.",
    );
  });

  it("[P1][4.3-037] given 'bear' winner, renders aria-label including winner", () => {
    render(<ArchivedBadge winner="bear" />);
    const badge = screen.getByText(/Completed Debate/).closest("[aria-label]");
    expect(badge?.getAttribute("aria-label")).toContain("Bear Wins");
  });
});

describe("DebateTranscript", () => {
  it("[P1][4.3-038] given bull and bear messages, renders content with role labels", () => {
    const messages = [
      createMockTranscriptMessage("bull", "Rising trend"),
      createMockTranscriptMessage("bear", "Falling trend"),
    ];
    render(<DebateTranscript messages={messages} />);
    expect(screen.getByText("Rising trend")).toBeInTheDocument();
    expect(screen.getByText("Falling trend")).toBeInTheDocument();
    expect(screen.getByText("Bull Agent")).toBeInTheDocument();
    expect(screen.getByText("Bear Agent")).toBeInTheDocument();
  });

  it("[P1][4.3-039] given null messages, renders 'Transcript not available'", () => {
    render(<DebateTranscript messages={null} />);
    expect(screen.getByText("Transcript not available")).toBeInTheDocument();
  });

  it("[P1][4.3-040] given empty messages array, renders 'Transcript not available'", () => {
    render(<DebateTranscript messages={[]} />);
    expect(screen.getByText("Transcript not available")).toBeInTheDocument();
  });

  it("[P1][4.3-041] given 8 messages (>6 threshold), renders disclosure with overflow count", () => {
    const messages = Array.from({ length: 8 }, (_, i) =>
      createMockTranscriptMessage(i % 2 === 0 ? "bull" : "bear", `Message ${i + 1}`),
    );
    render(<DebateTranscript messages={messages} />);
    expect(screen.getByText("Show full transcript (2 more messages)")).toBeInTheDocument();
    expect(screen.getByText("Message 1")).toBeInTheDocument();
  });

  it("[P1][4.3-042] given 6 messages (at threshold), renders no disclosure", () => {
    const messages = Array.from({ length: 6 }, (_, i) =>
      createMockTranscriptMessage("bull", `Msg ${i}`),
    );
    render(<DebateTranscript messages={messages} />);
    expect(screen.queryByText(/Show full transcript/)).not.toBeInTheDocument();
  });

  it("[P1][4.3-043] given 'guardian' role message, renders with 'Risk Guardian' label", () => {
    const messages = [
      createMockTranscriptMessage("guardian", "High risk detected"),
    ];
    render(<DebateTranscript messages={messages} />);
    expect(screen.getByText("Risk Guardian")).toBeInTheDocument();
    expect(screen.getByText("High risk detected")).toBeInTheDocument();
  });

  it("[P1][4.3-044] given 'risk_guardian' role variant, renders with 'Risk Guardian' label", () => {
    const messages = [
      createMockTranscriptMessage("risk_guardian", "Caution advised"),
    ];
    render(<DebateTranscript messages={messages} />);
    expect(screen.getByText("Risk Guardian")).toBeInTheDocument();
  });

  it("[P2][4.3-045] given unrecognized role, renders raw role name as label", () => {
    const messages = [
      createMockTranscriptMessage("analyst", "Custom analysis"),
    ];
    render(<DebateTranscript messages={messages} />);
    expect(screen.getByText("analyst")).toBeInTheDocument();
    expect(screen.getByText("Custom analysis")).toBeInTheDocument();
  });

  it("[P2][4.3-046] given 7 messages, disclosure shows correct overflow count of 1", () => {
    const messages = Array.from({ length: 7 }, (_, i) =>
      createMockTranscriptMessage("bull", `Msg ${i}`),
    );
    render(<DebateTranscript messages={messages} />);
    expect(
      screen.getByText("Show full transcript (1 more messages)"),
    ).toBeInTheDocument();
  });

  it("[P2][4.3-047] given transcript messages, renders section with role=log and aria-label", () => {
    const messages = [createMockTranscriptMessage("bull", "Test")];
    const { container } = render(<DebateTranscript messages={messages} />);
    const section = container.querySelector('[role="log"]');
    expect(section).toBeInTheDocument();
    expect(section?.getAttribute("aria-label")).toBe("Debate transcript");
  });
});
