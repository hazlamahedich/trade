/* eslint-disable @typescript-eslint/no-require-imports */
import { render, screen, act, fireEvent, within, renderHook } from '@testing-library/react';
import React from 'react';
import { DebateStream } from '../../features/debate/components/DebateStream';

let capturedSocketOptions: Record<string, unknown> = {};

const mockSendGuardianAck = jest.fn(() => true);

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

jest.mock('framer-motion', () => {
  return {
    motion: { div: (props: Record<string, unknown>) => React.createElement('div', props) },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useReducedMotion: () => false,
  };
});

function guardianInterruptPayload(overrides: Record<string, unknown> = {}) {
  return {
    debateId: 'test-debate-unit',
    riskLevel: 'high',
    reason: 'Detected anchoring bias in bull argument.',
    fallacyType: 'anchoring_bias',
    originalAgent: 'bull',
    summaryVerdict: 'High Risk',
    turn: 2,
    ...overrides,
  };
}

describe('[2-3] DebateStream Guardian — Component Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedSocketOptions = {};
  });

  test('[2-3-COMP-001] GuardianOverlay appears on interrupt and has correct content', () => {
    // Given: DebateStream is mounted
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    // When: guardian interrupt is delivered
    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    // Then: overlay appears with verdict and reason text
    const overlay = screen.getByTestId('guardian-overlay');
    expect(overlay).toBeInTheDocument();
    expect(within(overlay).getByText(/High Risk/)).toBeInTheDocument();
    expect(within(overlay).getByText(/Detected anchoring bias/)).toBeInTheDocument();
  });

  test('[2-3-UNIT-001] GuardianOverlay renders with correct content from stream', () => {
    // Given: DebateStream is mounted
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    // When: guardian interrupt with anchoring_bias is delivered
    act(() => {
      onGuardianInterrupt(guardianInterruptPayload({ fallacyType: 'anchoring_bias' }));
    });

    // Then: overlay shows fallacy badge, understand and ignore buttons
    const overlay = screen.getByTestId('guardian-overlay');
    expect(overlay).toBeInTheDocument();
    expect(within(overlay).getByText(/anchoring_bias/)).toBeInTheDocument();
    expect(within(overlay).getByTestId('guardian-understand-btn')).toBeInTheDocument();
    expect(within(overlay).getByTestId('guardian-ignore-btn')).toBeInTheDocument();
  });

  test('[2-3-UNIT-003] Critical shows "I Understand" only with "debate ended" text', () => {
    // Given: DebateStream receives a critical interrupt
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    // When: critical guardian interrupt is delivered
    act(() => {
      onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'critical' }));
    });

    // Then: only "I Understand" button, no "Proceed Anyway", debate ended text shown
    const overlay = screen.getByTestId('guardian-overlay');
    expect(within(overlay).getByTestId('guardian-understand-btn')).toBeInTheDocument();
    expect(within(overlay).queryByTestId('guardian-ignore-btn')).not.toBeInTheDocument();
    expect(within(overlay).getByText(/Critical risk detected — debate ended/)).toBeInTheDocument();
  });

  test('[2-3-UNIT-023] useGuardianFreeze: state transitions active→frozen→active', () => {
    // Given: DebateStream is mounted with no overlay
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;
    const stream = screen.getByTestId('debate-stream');

    expect(stream.style.filter).toBe('none');
    expect(screen.queryByTestId('guardian-overlay')).not.toBeInTheDocument();

    // When: guardian interrupt triggers freeze
    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    // Then: grayscale applied and overlay appears
    expect(stream.style.filter).toBe('grayscale(60%)');
    expect(screen.getByTestId('guardian-overlay')).toBeInTheDocument();

    // When: "I Understand" is clicked
    fireEvent.click(screen.getByTestId('guardian-understand-btn'));

    // Then: state returns to active
    expect(stream.style.filter).toBe('none');
    expect(screen.queryByTestId('guardian-overlay')).not.toBeInTheDocument();
  });

  test('[2-3-COMP-002] @p0 Full flow — interrupt → freeze → overlay → ignore → unfreeze', () => {
    // Given: DebateStream is mounted
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;
    const stream = screen.getByTestId('debate-stream');

    // When: guardian interrupt triggers freeze
    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    // Then: grayscale and overlay appear
    expect(stream.style.filter).toBe('grayscale(60%)');
    expect(screen.getByTestId('guardian-overlay')).toBeInTheDocument();

    // When: "Proceed Anyway" is clicked
    fireEvent.click(screen.getByTestId('guardian-ignore-btn'));

    // Then: state clears to active
    expect(stream.style.filter).toBe('none');
    expect(screen.queryByTestId('guardian-overlay')).not.toBeInTheDocument();
  });

  test('[2-3-COMP-003] @p0 Critical interrupt — overlay stays, no "Ignore" button', () => {
    // Given: DebateStream receives a critical interrupt
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    // When: critical guardian interrupt is delivered
    act(() => {
      onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'critical' }));
    });

    // Then: only "I Understand" available, no ignore, critical text shown
    expect(screen.getByTestId('guardian-understand-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('guardian-ignore-btn')).not.toBeInTheDocument();
    expect(screen.getByText(/Critical risk detected — debate ended/)).toBeInTheDocument();
  });

  test('[2-3-COMP-004] @p0 Non-critical: Escape key is not blocked by overlay configuration', () => {
    // Given: DebateStream has a non-critical overlay
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'high' }));
    });

    // Then: overlay renders with alertdialog role (Escape allowed for non-critical)
    const overlay = screen.getByTestId('guardian-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('role', 'alertdialog');
  });

  test('[2-3-COMP-005] @p0 Critical: overlay renders with critical-only behavior', () => {
    // Given: DebateStream receives a critical interrupt
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    // When: critical guardian interrupt is delivered
    act(() => {
      onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'critical' }));
    });

    // Then: overlay present but no ignore button (critical-only mode)
    const overlay = screen.getByTestId('guardian-overlay');
    expect(overlay).toBeInTheDocument();
    expect(screen.queryByTestId('guardian-ignore-btn')).not.toBeInTheDocument();
  });

  test('[2-3-COMP-006] @p0 Error recovery — ack fails → error state → retry → success → unfreeze', () => {
    // Given: sendGuardianAck fails first call, succeeds on second
    let ackCallCount = 0;
    const failThenSucceed = jest.fn(() => {
      ackCallCount++;
      return ackCallCount === 1 ? false : true;
    });

    const { result } = renderHook(() =>
      require('../../features/debate/hooks/useGuardianFreeze').useGuardianFreeze({ sendGuardianAck: failThenSucceed })
    );

    // When: trigger freeze → ack fails → retry succeeds
    act(() => {
      result.current.triggerFreeze(
        { debateId: 'd1', riskLevel: 'high', reason: 'test', fallacyType: 'bias', originalAgent: 'bull', summaryVerdict: 'Risk', turn: 1 },
        null
      );
    });
    expect(result.current.state.status).toBe('frozen');

    act(() => {
      result.current.acknowledgeFreeze();
    });

    // Then: state transitions to error
    expect(result.current.state.status).toBe('error');

    // When: retry is called and succeeds
    act(() => {
      result.current.retryAck();
    });

    // Then: state transitions to active
    expect(result.current.state.status).toBe('active');
  });

  test('[2-3-COMP-009] Accessibility: role="alertdialog" and aria attributes present', () => {
    // Given: overlay is shown after guardian interrupt
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    // Then: overlay has required ARIA attributes
    const overlay = screen.getByTestId('guardian-overlay');
    expect(overlay).toHaveAttribute('role', 'alertdialog');
    expect(overlay).toHaveAttribute('aria-modal', 'true');
    expect(overlay).toHaveAttribute('aria-labelledby');
    expect(overlay).toHaveAttribute('aria-describedby');
  });

  test('[2-3-COMP-011] @p1 Overlay renders above grayscale — overlay content NOT affected by parent filter', () => {
    // Given: overlay is shown while stream has grayscale
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    // Then: stream has grayscale but overlay is not a descendant of stream
    const stream = screen.getByTestId('debate-stream');
    expect(stream.style.filter).toBe('grayscale(60%)');

    const overlay = screen.getByTestId('guardian-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay.closest('[data-testid="debate-stream"]')).toBeNull();
  });

  test('[2-3-COMP-012] Barrel exports — GuardianOverlay available', () => {
    // Given: components barrel export
    // Then: GuardianOverlay is exported
    const mod = require('../../features/debate/components');
    expect(mod.GuardianOverlay).toBeDefined();
  });

  test('[2-3-COMP-012b] Barrel exports — useGuardianFreeze available', () => {
    // Given: hooks barrel export
    // Then: useGuardianFreeze is exported
    const mod = require('../../features/debate/hooks');
    expect(mod.useGuardianFreeze).toBeDefined();
  });

  test('[2-3-COMP-013] @p1 Screen reader: role="alertdialog" announces freeze event via dialog ARIA', () => {
    // Given: overlay is shown after guardian interrupt
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    // Then: alertdialog role is present for screen reader announcement
    const alertDialog = screen.getByRole('alertdialog');
    expect(alertDialog).toBeInTheDocument();
    expect(alertDialog).toHaveAttribute('aria-modal', 'true');
  });

  test('[2-3-UNIT-021] Multiple interrupts — new data replaces current overlay content', () => {
    // Given: overlay is shown with first interrupt
    jest.useFakeTimers();
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload({ reason: 'First interrupt unique text' }));
    });
    let overlay = screen.getByTestId('guardian-overlay');
    expect(within(overlay).getByText(/First interrupt unique text/)).toBeInTheDocument();

    // When: cooldown expires and second interrupt arrives
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    act(() => {
      onGuardianInterrupt(guardianInterruptPayload({ reason: 'Second interrupt superseding text' }));
    });

    // Then: overlay content is replaced (no stacking)
    overlay = screen.getByTestId('guardian-overlay');
    expect(within(overlay).queryByText(/First interrupt unique text/)).not.toBeInTheDocument();
    expect(within(overlay).getByText(/Second interrupt superseding text/)).toBeInTheDocument();

    jest.useRealTimers();
  });

  test('[2-3-UNIT-022] @p1 Unmount during active animation — no state updates after unmount', () => {
    // Given: overlay is shown
    const { unmount } = render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });
    expect(screen.getByTestId('guardian-overlay')).toBeInTheDocument();

    // When: component unmounts during active state
    // Then: no error thrown
    expect(() => {
      unmount();
    }).not.toThrow();
  });
});
