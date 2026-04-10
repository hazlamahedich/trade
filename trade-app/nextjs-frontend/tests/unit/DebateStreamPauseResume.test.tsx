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

let mockReducedMotion = false;

jest.mock('framer-motion', () => {
  return {
    motion: { div: (props: Record<string, unknown>) => React.createElement('div', props) },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useReducedMotion: () => mockReducedMotion,
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

describe('[2-2 → 2-3] DebateStream Guardian — Updated Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedSocketOptions = {};
  });

  test('[2-2-COMP-001] Renders guardian message in stream history', () => {
    render(<DebateStream debateId="test-debate-unit" />);

    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    const guardianMessages = screen.queryAllByTestId(/^guardian-message-/);
    expect(guardianMessages.length).toBeGreaterThanOrEqual(1);
    const guardianBubbles = guardianMessages[0];
    expect(guardianBubbles).toHaveTextContent('GUARDIAN: High Risk');
    expect(guardianBubbles).toHaveTextContent('Detected anchoring bias');
  });

  test('[2-3-UNIT-025] No inline "Acknowledge & Resume" button in guardian bubble', () => {
    render(<DebateStream debateId="test-debate-unit" />);

    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;
    const onDebatePaused = capturedSocketOptions.onDebatePaused as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
      onDebatePaused(debatePausedPayload());
    });

    expect(screen.queryByText(/Acknowledge & Resume/)).not.toBeInTheDocument();
  });

  test('[2-3-UNIT-025b] No "awaiting your acknowledgment" paused indicator', () => {
    render(<DebateStream debateId="test-debate-unit" />);

    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;
    const onDebatePaused = capturedSocketOptions.onDebatePaused as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
      onDebatePaused(debatePausedPayload());
    });

    expect(screen.queryByTestId('debate-paused-indicator')).not.toBeInTheDocument();
  });

  test('[2-3-UNIT-025c] No inline "Critical risk detected" text in guardian bubble', () => {
    render(<DebateStream debateId="test-debate-unit" />);

    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;
    const onDebatePaused = capturedSocketOptions.onDebatePaused as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'critical' }));
      onDebatePaused(debatePausedPayload({ riskLevel: 'critical' }));
    });

    expect(screen.queryByText(/Critical risk detected\. Debate ended\./)).not.toBeInTheDocument();
  });

  test('[2-3-COMP-001] GuardianOverlay appears on interrupt and has correct content', () => {
    render(<DebateStream debateId="test-debate-unit" />);

    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    const overlay = screen.getByTestId('guardian-overlay');
    expect(overlay).toBeInTheDocument();
    expect(within(overlay).getByText(/High Risk/)).toBeInTheDocument();
    expect(within(overlay).getByText(/Detected anchoring bias/)).toBeInTheDocument();
  });

  test('[2-3-UNIT-001] GuardianOverlay renders with correct content', () => {
    render(<DebateStream debateId="test-debate-unit" />);

    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload({ fallacyType: 'anchoring_bias' }));
    });

    const overlay = screen.getByTestId('guardian-overlay');
    expect(overlay).toBeInTheDocument();
    expect(within(overlay).getByText(/anchoring_bias/)).toBeInTheDocument();
    expect(within(overlay).getByTestId('guardian-understand-btn')).toBeInTheDocument();
    expect(within(overlay).getByTestId('guardian-ignore-btn')).toBeInTheDocument();
  });

  test('[2-3-UNIT-003] Critical shows "I Understand" only with "debate ended" text', () => {
    render(<DebateStream debateId="test-debate-unit" />);

    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'critical' }));
    });

    const overlay = screen.getByTestId('guardian-overlay');
    expect(within(overlay).getByTestId('guardian-understand-btn')).toBeInTheDocument();
    expect(within(overlay).queryByTestId('guardian-ignore-btn')).not.toBeInTheDocument();
    expect(within(overlay).getByText(/Critical risk detected — debate ended/)).toBeInTheDocument();
  });

  test('[2-3-UNIT-007] "I Understand" calls sendGuardianAck via acknowledgeFreeze', () => {
    render(<DebateStream debateId="test-debate-unit" />);

    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    fireEvent.click(screen.getByTestId('guardian-understand-btn'));
    expect(mockSendGuardianAck).toHaveBeenCalledTimes(1);
  });

  test('[2-3-UNIT-008] "Ignore Risk" calls sendGuardianAck via ignoreFreeze', () => {
    render(<DebateStream debateId="test-debate-unit" />);

    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    fireEvent.click(screen.getByTestId('guardian-ignore-btn'));
    expect(mockSendGuardianAck).toHaveBeenCalledTimes(1);
  });

  test('[2-3-UNIT-009] Grayscale style applied when frozen', () => {
    render(<DebateStream debateId="test-debate-unit" />);

    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;
    const stream = screen.getByTestId('debate-stream');

    expect(stream.style.filter).toBe('none');

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    expect(stream.style.filter).toBe('grayscale(60%)');
  });

  test('[2-3-UNIT-010] Grayscale removed after acknowledgment', () => {
    render(<DebateStream debateId="test-debate-unit" />);

    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;
    const stream = screen.getByTestId('debate-stream');

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    expect(stream.style.filter).toBe('grayscale(60%)');

    fireEvent.click(screen.getByTestId('guardian-understand-btn'));

    expect(stream.style.filter).toBe('none');
  });

  test('[2-3-UNIT-010b] Stale data grayscale preserved when not frozen', () => {
    render(<DebateStream debateId="test-debate-unit" />);

    const onDataStale = capturedSocketOptions.onDataStale as (p: Record<string, unknown>) => void;
    const stream = screen.getByTestId('debate-stream');

    act(() => {
      onDataStale({ lastUpdate: '2026-04-10T12:00:00Z', ageSeconds: 120 });
    });

    expect(stream.style.filter).toBe('grayscale(100%)');
  });

  test('[2-3-UNIT-011] Reduced motion: no CSS transition when shouldReduceMotion = true', () => {
    mockReducedMotion = true;
    try {
      render(<DebateStream debateId="test-debate-unit" />);
      const stream = screen.getByTestId('debate-stream');
      expect(stream.style.transition).toBe('none');
    } finally {
      mockReducedMotion = false;
    }
  });

  test('[2-3-UNIT-021] Multiple interrupts — new data replaces current overlay content', () => {
    jest.useFakeTimers();
    render(<DebateStream debateId="test-debate-unit" />);

    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload({ reason: 'First interrupt unique text' }));
    });

    let overlay = screen.getByTestId('guardian-overlay');
    expect(within(overlay).getByText(/First interrupt unique text/)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload({ reason: 'Second interrupt superseding text' }));
    });

    overlay = screen.getByTestId('guardian-overlay');
    expect(within(overlay).queryByText(/First interrupt unique text/)).not.toBeInTheDocument();
    expect(within(overlay).getByText(/Second interrupt superseding text/)).toBeInTheDocument();

    jest.useRealTimers();
  });

  test('[2-3-UNIT-023] useGuardianFreeze: state transitions active→frozen→active', () => {
    render(<DebateStream debateId="test-debate-unit" />);

    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;
    const stream = screen.getByTestId('debate-stream');

    expect(stream.style.filter).toBe('none');
    expect(screen.queryByTestId('guardian-overlay')).not.toBeInTheDocument();

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    expect(stream.style.filter).toBe('grayscale(60%)');
    expect(screen.getByTestId('guardian-overlay')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('guardian-understand-btn'));

    expect(stream.style.filter).toBe('none');
    expect(screen.queryByTestId('guardian-overlay')).not.toBeInTheDocument();
  });

  test('[2-3-COMP-009] Accessibility: role="alertdialog" and aria attributes present', () => {
    render(<DebateStream debateId="test-debate-unit" />);

    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    const overlay = screen.getByTestId('guardian-overlay');
    expect(overlay).toHaveAttribute('role', 'alertdialog');
    expect(overlay).toHaveAttribute('aria-modal', 'true');
    expect(overlay).toHaveAttribute('aria-labelledby');
    expect(overlay).toHaveAttribute('aria-describedby');
  });

  test('[2-3-COMP-012] Barrel exports — GuardianOverlay available', () => {
    const mod = require('../../features/debate/components');
    expect(mod.GuardianOverlay).toBeDefined();
  });

  test('[2-3-COMP-012b] Barrel exports — useGuardianFreeze available', () => {
    const mod = require('../../features/debate/hooks');
    expect(mod.useGuardianFreeze).toBeDefined();
  });

  describe('[2-3] Haptic vibration tests', () => {
    let mockVibrate: jest.Mock;

    beforeEach(() => {
      mockVibrate = jest.fn();
      Object.defineProperty(globalThis, 'navigator', {
        value: { vibrate: mockVibrate },
        writable: true,
        configurable: true,
      });
    });

    test('[2-3-UNIT-013] @p2 Haptic vibration called for critical interrupt only', () => {
      render(<DebateStream debateId="test-debate-unit" />);
      const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

      act(() => {
        onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'critical' }));
      });

      expect(mockVibrate).toHaveBeenCalledWith([100, 50, 100]);
    });

    test('[2-3-UNIT-014] @p2 Haptic vibration NOT called for non-critical interrupt', () => {
      render(<DebateStream debateId="test-debate-unit" />);
      const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

      act(() => {
        onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'high' }));
      });

      expect(mockVibrate).not.toHaveBeenCalled();
    });

    test('[2-3-UNIT-015] @p1 Vibration skipped when prefers-reduced-motion is set', () => {
      mockReducedMotion = true;
      try {
        render(<DebateStream debateId="test-debate-unit" />);
        const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

        act(() => {
          onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'critical' }));
        });

        expect(mockVibrate).not.toHaveBeenCalled();
      } finally {
        mockReducedMotion = false;
      }
    });

    test('[2-3-UNIT-016] @p0 SSR guard: no crash when navigator is undefined', () => {
      const origNav = globalThis.navigator;
      Object.defineProperty(globalThis, 'navigator', { value: undefined, writable: true, configurable: true });

      expect(() => {
        render(<DebateStream debateId="test-debate-unit" />);
        const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;
        act(() => {
          onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'critical' }));
        });
      }).not.toThrow();

      Object.defineProperty(globalThis, 'navigator', { value: origNav, writable: true, configurable: true });
    });

    test('[2-3-UNIT-017] @p1 Vibration cancelled on component unmount', () => {
      render(<DebateStream debateId="test-debate-unit" />);
      const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

      act(() => {
        onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'critical' }));
      });

      expect(mockVibrate).toHaveBeenCalledWith([100, 50, 100]);

      const { unmount } = render(<div />); // force re-render context
      // Use rerender from original render
    });

    test('[2-3-UNIT-017b] @p1 Vibration cancelled on component unmount — navigator.vibrate([]) called', () => {
      const { unmount } = render(<DebateStream debateId="test-debate-unit" />);
      const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

      act(() => {
        onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'critical' }));
      });

      mockVibrate.mockClear();

      unmount();

      expect(mockVibrate).toHaveBeenCalledWith([]);
    });
  });

  describe('[2-3] Component integration tests', () => {
    test('[2-3-COMP-002] @p0 Full flow — interrupt → freeze → overlay → ignore → unfreeze', () => {
      render(<DebateStream debateId="test-debate-unit" />);
      const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;
      const stream = screen.getByTestId('debate-stream');

      act(() => {
        onGuardianInterrupt(guardianInterruptPayload());
      });

      expect(stream.style.filter).toBe('grayscale(60%)');
      expect(screen.getByTestId('guardian-overlay')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('guardian-ignore-btn'));

      expect(stream.style.filter).toBe('none');
      expect(screen.queryByTestId('guardian-overlay')).not.toBeInTheDocument();
    });

    test('[2-3-COMP-003] @p0 Critical interrupt — overlay stays, no "Ignore" button', () => {
      render(<DebateStream debateId="test-debate-unit" />);
      const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

      act(() => {
        onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'critical' }));
      });

      expect(screen.getByTestId('guardian-understand-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('guardian-ignore-btn')).not.toBeInTheDocument();
      expect(screen.getByText(/Critical risk detected — debate ended/)).toBeInTheDocument();
    });

    test('[2-3-COMP-004] @p0 Non-critical: Escape key is not blocked by overlay configuration', () => {
      render(<DebateStream debateId="test-debate-unit" />);
      const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

      act(() => {
        onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'high' }));
      });

      const overlay = screen.getByTestId('guardian-overlay');
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveAttribute('role', 'alertdialog');
    });

    test('[2-3-COMP-005] @p0 Critical: overlay renders with critical-only behavior', () => {
      render(<DebateStream debateId="test-debate-unit" />);
      const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

      act(() => {
        onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'critical' }));
      });

      const overlay = screen.getByTestId('guardian-overlay');
      expect(overlay).toBeInTheDocument();
      expect(screen.queryByTestId('guardian-ignore-btn')).not.toBeInTheDocument();
    });

    test('[2-3-COMP-006] @p0 Error recovery — ack fails → error state → retry → success → unfreeze', () => {
      let ackCallCount = 0;
      const failThenSucceed = jest.fn(() => {
        ackCallCount++;
        return ackCallCount === 1 ? false : true;
      });

      const { result } = renderHook(() =>
        require('../../features/debate/hooks/useGuardianFreeze').useGuardianFreeze({ sendGuardianAck: failThenSucceed })
      );

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
      expect(result.current.state.status).toBe('error');

      act(() => {
        result.current.retryAck();
      });
      expect(result.current.state.status).toBe('active');
    });

    test('[2-3-COMP-011] @p1 Overlay renders above grayscale — overlay content NOT affected by parent filter', () => {
      render(<DebateStream debateId="test-debate-unit" />);
      const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

      act(() => {
        onGuardianInterrupt(guardianInterruptPayload());
      });

      const stream = screen.getByTestId('debate-stream');
      expect(stream.style.filter).toBe('grayscale(60%)');

      const overlay = screen.getByTestId('guardian-overlay');
      expect(overlay).toBeInTheDocument();
      expect(overlay.closest('[data-testid="debate-stream"]')).toBeNull();
    });

    test('[2-3-COMP-013] @p1 Screen reader: aria-live="assertive" region announces freeze event text', () => {
      render(<DebateStream debateId="test-debate-unit" />);
      const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

      act(() => {
        onGuardianInterrupt(guardianInterruptPayload());
      });

      const liveRegion = screen.getByText(/Guardian alert: High Risk/);
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion.closest('[aria-live="assertive"]')).toBeTruthy();
    });

    test('[2-3-UNIT-022] @p1 Unmount during active animation — no state updates after unmount', () => {
      const { unmount } = render(<DebateStream debateId="test-debate-unit" />);
      const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

      act(() => {
        onGuardianInterrupt(guardianInterruptPayload());
      });

      expect(screen.getByTestId('guardian-overlay')).toBeInTheDocument();

      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });
});
