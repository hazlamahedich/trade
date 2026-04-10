import { render, screen, fireEvent, act } from '@testing-library/react';
import { DebateStream } from '../../features/debate/components/DebateStream';

// ---------------------------------------------------------------------------
// Mock: useDebateSocket
//
// We capture the options object so tests can invoke the socket callbacks
// (onGuardianInterrupt, onDebatePaused, onDebateResumed) directly.
// ---------------------------------------------------------------------------
let capturedSocketOptions: Record<string, unknown> = {};

const mockSendGuardianAck = jest.fn();

jest.mock('../../features/debate/hooks/useDebateSocket', () => ({
  useDebateSocket: jest.fn((options: Record<string, unknown>) => {
    capturedSocketOptions = options;
    return {
      status: 'connected',
      isConnected: true,
      sendGuardianAck: mockSendGuardianAck,
    };
  }),
}));

// ---------------------------------------------------------------------------
// Mock: useReasoningGraph
// ---------------------------------------------------------------------------
jest.mock('../../features/debate/hooks/useReasoningGraph', () => ({
  useReasoningGraph: jest.fn(() => ({
    nodes: [],
    edges: [],
    onNodesChange: jest.fn(),
    onEdgesChange: jest.fn(),
  })),
}));

jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn(({ count, estimateSize }) => ({
    getTotalSize: () => count * 100,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 100,
        size: estimateSize ? estimateSize(i) : 100,
        key: `virtual-${i}`,
      })),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic payload matching the GuardianInterruptPayload interface */
function guardianInterruptPayload(overrides: Record<string, unknown> = {}) {
  return {
    debateId: 'test-debate-unit',
    riskLevel: 'high',
    reason: 'Detected anchoring bias in bull argument — confidence exceeds evidence.',
    fallacyType: 'anchoring_bias',
    originalAgent: 'bull',
    summaryVerdict: 'High Risk',
    turn: 2,
    ...overrides,
  };
}

/** Deterministic payload matching the DebatePausedPayload interface */
function debatePausedPayload(overrides: Record<string, unknown> = {}) {
  return {
    debateId: 'test-debate-unit',
    reason: 'Risk Guardian detected a potential cognitive bias.',
    riskLevel: 'high',
    summaryVerdict: 'High Risk',
    turn: 2,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('[2-2] DebateStream Pause & Resume — Component Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedSocketOptions = {};
  });

  // -------------------------------------------------------------------------
  // 2-2-COMP-001
  // -------------------------------------------------------------------------
  test('[2-2-COMP-001] Renders guardian message with data-testid @p1', () => {
    // Given: DebateStream is rendered
    render(<DebateStream debateId="test-debate-unit" />);

    // When: A Guardian interrupt fires
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (
      p: Record<string, unknown>,
    ) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    // Then: A guardian message element with data-testid is present
    const guardianMessages = screen.queryAllByTestId(/^guardian-message-/);
    expect(guardianMessages.length).toBeGreaterThanOrEqual(1);

    // And: "GUARDIAN:" label with the summary verdict is visible
    expect(screen.getByText(/GUARDIAN: High Risk/)).toBeInTheDocument();

    // And: The reason text is visible
    expect(
      screen.getByText(/Detected anchoring bias in bull argument/),
    ).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 2-2-COMP-002
  // -------------------------------------------------------------------------
  test('[2-2-COMP-002] Shows paused indicator when DEBATE_PAUSED received @p1', () => {
    // Given: DebateStream is rendered
    render(<DebateStream debateId="test-debate-unit" />);

    // When: A Guardian interrupt fires and debate is paused
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (
      p: Record<string, unknown>,
    ) => void;
    const onDebatePaused = capturedSocketOptions.onDebatePaused as (
      p: Record<string, unknown>,
    ) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
      onDebatePaused(debatePausedPayload());
    });

    // Then: The paused indicator is visible
    const pausedIndicator = screen.getByTestId('debate-paused-indicator');
    expect(pausedIndicator).toBeInTheDocument();

    // And: Text "awaiting your acknowledgment" is present
    expect(pausedIndicator).toHaveTextContent('awaiting your acknowledgment');
  });

  // -------------------------------------------------------------------------
  // 2-2-COMP-003
  // -------------------------------------------------------------------------
  test('[2-2-COMP-003] Acknowledge button only on latest guardian message @p1', () => {
    // Given: DebateStream is rendered
    render(<DebateStream debateId="test-debate-unit" />);

    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (
      p: Record<string, unknown>,
    ) => void;
    const onDebatePaused = capturedSocketOptions.onDebatePaused as (
      p: Record<string, unknown>,
    ) => void;

    // When: First Guardian interrupt fires and debate is paused
    act(() => {
      onGuardianInterrupt(
        guardianInterruptPayload({
          reason: 'First interrupt reason.',
          summaryVerdict: 'High Risk',
        }),
      );
      onDebatePaused(debatePausedPayload());
    });

    // Then: One acknowledge button is present
    let ackButtons = screen.queryAllByTestId(/^ack-guardian-/);
    expect(ackButtons).toHaveLength(1);

    // When: A second Guardian interrupt fires (before resume)
    act(() => {
      onGuardianInterrupt(
        guardianInterruptPayload({
          reason: 'Second interrupt reason — superseding the first.',
          summaryVerdict: 'High Risk',
        }),
      );
    });

    // Then: Still only ONE acknowledge button (the latest guardian message's)
    ackButtons = screen.queryAllByTestId(/^ack-guardian-/);
    expect(ackButtons).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // 2-2-COMP-004 (bonus: verify clicking ack calls sendGuardianAck)
  // -------------------------------------------------------------------------
  test('[2-2-COMP-004] Clicking acknowledge button calls sendGuardianAck @p1', () => {
    // Given: DebateStream is rendered and paused via Guardian
    render(<DebateStream debateId="test-debate-unit" />);

    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (
      p: Record<string, unknown>,
    ) => void;
    const onDebatePaused = capturedSocketOptions.onDebatePaused as (
      p: Record<string, unknown>,
    ) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
      onDebatePaused(debatePausedPayload());
    });

    // When: User clicks the acknowledge button
    const ackButton = screen.getByTestId(/^ack-guardian-/);
    fireEvent.click(ackButton);

    // Then: sendGuardianAck was called
    expect(mockSendGuardianAck).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // 2-2-COMP-005 (bonus: resume clears paused state)
  // -------------------------------------------------------------------------
  test('[2-2-COMP-005] DEBATE_RESUMED clears paused indicator @p1', () => {
    // Given: DebateStream is rendered and paused
    render(<DebateStream debateId="test-debate-unit" />);

    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (
      p: Record<string, unknown>,
    ) => void;
    const onDebatePaused = capturedSocketOptions.onDebatePaused as (
      p: Record<string, unknown>,
    ) => void;
    const onDebateResumed = capturedSocketOptions.onDebateResumed as (
      p: Record<string, unknown>,
    ) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
      onDebatePaused(debatePausedPayload());
    });

    // Paused indicator is visible
    expect(screen.getByTestId('debate-paused-indicator')).toBeInTheDocument();

    // When: Debate is resumed
    act(() => {
      onDebateResumed({ debateId: 'test-debate-unit', turn: 3 });
    });

    // Then: Paused indicator is no longer visible
    expect(screen.queryByTestId('debate-paused-indicator')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 2-2-COMP-006 (bonus: critical risk shows no ack button)
  // -------------------------------------------------------------------------
  test('[2-2-COMP-006] Critical risk level shows no acknowledge button @p0', () => {
    // Given: DebateStream is rendered
    render(<DebateStream debateId="test-debate-unit" />);

    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (
      p: Record<string, unknown>,
    ) => void;
    const onDebatePaused = capturedSocketOptions.onDebatePaused as (
      p: Record<string, unknown>,
    ) => void;

    // When: A critical Guardian interrupt fires
    act(() => {
      onGuardianInterrupt(
        guardianInterruptPayload({
          riskLevel: 'critical',
          summaryVerdict: 'Critical',
        }),
      );
      onDebatePaused(
        debatePausedPayload({
          riskLevel: 'critical',
          summaryVerdict: 'Critical',
        }),
      );
    });

    // Then: No acknowledge button is shown
    const ackButtons = screen.queryAllByTestId(/^ack-guardian-/);
    expect(ackButtons).toHaveLength(0);

    // And: "Critical risk detected. Debate ended." text is shown
    expect(screen.getByText(/Critical risk detected\. Debate ended\./)).toBeInTheDocument();
  });
});
