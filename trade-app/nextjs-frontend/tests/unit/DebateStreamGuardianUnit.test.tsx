import { render, screen, act, fireEvent } from '@testing-library/react';
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

describe('[2-3] DebateStream Guardian — Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedSocketOptions = {};
  });

  test('[2-2-COMP-001] Renders guardian message in stream history', () => {
    // Given: DebateStream is mounted and receives a guardian interrupt
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    // When: guardian interrupt payload is delivered
    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    // Then: guardian message appears in the stream with verdict and reason
    const guardianMessages = screen.queryAllByTestId(/^guardian-message-/);
    expect(guardianMessages.length).toBeGreaterThanOrEqual(1);
    const guardianBubbles = guardianMessages[0];
    expect(guardianBubbles).toHaveTextContent('GUARDIAN: High Risk');
    expect(guardianBubbles).toHaveTextContent('Detected anchoring bias');
  });

  test('[2-3-UNIT-025] No inline "Acknowledge & Resume" button in guardian bubble', () => {
    // Given: DebateStream receives a guardian interrupt
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    // When: interrupt is delivered
    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    // Then: no inline acknowledge button exists (moved to overlay)
    expect(screen.queryByText(/Acknowledge & Resume/)).not.toBeInTheDocument();
  });

  test('[2-3-UNIT-025b] No "awaiting your acknowledgment" paused indicator', () => {
    // Given: DebateStream receives a guardian interrupt
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    // Then: no paused indicator (replaced by overlay)
    expect(screen.queryByTestId('debate-paused-indicator')).not.toBeInTheDocument();
  });

  test('[2-3-UNIT-025c] No inline "Critical risk detected" text in guardian bubble', () => {
    // Given: DebateStream receives a critical guardian interrupt
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'critical' }));
    });

    // Then: no inline critical text in guardian bubble (moved to overlay)
    expect(screen.queryByText(/Critical risk detected\. Debate ended\./)).not.toBeInTheDocument();
  });

  test('[2-3-UNIT-009] Grayscale style applied when frozen', () => {
    // Given: DebateStream is mounted with default filter
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;
    const stream = screen.getByTestId('debate-stream');
    expect(stream.style.filter).toBe('none');

    // When: guardian interrupt arrives
    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    // Then: grayscale(60%) CSS filter is applied
    expect(stream.style.filter).toBe('grayscale(60%)');
  });

  test('[2-3-UNIT-010] Grayscale removed after acknowledgment', () => {
    // Given: DebateStream is in frozen state with grayscale
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;
    const stream = screen.getByTestId('debate-stream');

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });
    expect(stream.style.filter).toBe('grayscale(60%)');

    // When: "I Understand" is clicked
    fireEvent.click(screen.getByTestId('guardian-understand-btn'));

    // Then: filter returns to none
    expect(stream.style.filter).toBe('none');
  });

  test('[2-3-UNIT-010b] Stale data grayscale preserved when not frozen', () => {
    // Given: DebateStream receives a data stale event
    render(<DebateStream debateId="test-debate-unit" />);
    const onDataStale = capturedSocketOptions.onDataStale as (p: Record<string, unknown>) => void;
    const stream = screen.getByTestId('debate-stream');

    // When: data stale event is delivered
    act(() => {
      onDataStale({ lastUpdate: '2026-04-10T12:00:00Z', ageSeconds: 120 });
    });

    // Then: grayscale(100%) is applied for stale data
    expect(stream.style.filter).toBe('grayscale(100%)');
  });

  test('[2-3-UNIT-011] Reduced motion: no CSS transition when shouldReduceMotion = true', () => {
    // Given: user prefers reduced motion
    mockReducedMotion = true;
    try {
      render(<DebateStream debateId="test-debate-unit" />);
      const stream = screen.getByTestId('debate-stream');

      // Then: CSS transition is set to none
      expect(stream.style.transition).toBe('none');
    } finally {
      mockReducedMotion = false;
    }
  });

  test('[2-3-UNIT-007] "I Understand" calls sendGuardianAck via acknowledgeFreeze', () => {
    // Given: overlay is shown after guardian interrupt
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    // When: "I Understand" is clicked
    fireEvent.click(screen.getByTestId('guardian-understand-btn'));

    // Then: sendGuardianAck is called exactly once
    expect(mockSendGuardianAck).toHaveBeenCalledTimes(1);
  });

  test('[2-3-UNIT-008] "Proceed Anyway" calls sendGuardianAck via ignoreFreeze', () => {
    // Given: overlay is shown with non-critical interrupt
    render(<DebateStream debateId="test-debate-unit" />);
    const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

    act(() => {
      onGuardianInterrupt(guardianInterruptPayload());
    });

    // When: "Proceed Anyway" is clicked
    fireEvent.click(screen.getByTestId('guardian-ignore-btn'));

    // Then: sendGuardianAck is called exactly once
    expect(mockSendGuardianAck).toHaveBeenCalledTimes(1);
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
      // Given: DebateStream is mounted
      render(<DebateStream debateId="test-debate-unit" />);
      const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

      // When: critical guardian interrupt arrives
      act(() => {
        onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'critical' }));
      });

      // Then: vibration is triggered with heartbeat pattern
      expect(mockVibrate).toHaveBeenCalledWith([100, 50, 100]);
    });

    test('[2-3-UNIT-014] @p2 Haptic vibration NOT called for non-critical interrupt', () => {
      // Given: DebateStream is mounted
      render(<DebateStream debateId="test-debate-unit" />);
      const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

      // When: non-critical (high) guardian interrupt arrives
      act(() => {
        onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'high' }));
      });

      // Then: vibration is not triggered
      expect(mockVibrate).not.toHaveBeenCalled();
    });

    test('[2-3-UNIT-015] @p1 Vibration skipped when prefers-reduced-motion is set', () => {
      // Given: user prefers reduced motion
      mockReducedMotion = true;
      try {
        render(<DebateStream debateId="test-debate-unit" />);
        const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

        // When: critical interrupt arrives during reduced motion
        act(() => {
          onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'critical' }));
        });

        // Then: vibration is suppressed
        expect(mockVibrate).not.toHaveBeenCalled();
      } finally {
        mockReducedMotion = false;
      }
    });

    test('[2-3-UNIT-016] @p0 SSR guard: no crash when navigator is undefined', () => {
      // Given: navigator is undefined (SSR environment)
      const origNav = globalThis.navigator;
      Object.defineProperty(globalThis, 'navigator', { value: undefined, writable: true, configurable: true });

      // When: rendering with critical interrupt
      expect(() => {
        render(<DebateStream debateId="test-debate-unit" />);
        const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;
        act(() => {
          onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'critical' }));
        });
      // Then: no crash occurs
      }).not.toThrow();

      Object.defineProperty(globalThis, 'navigator', { value: origNav, writable: true, configurable: true });
    });

    test('[2-3-UNIT-017b] @p1 Vibration cancelled on component unmount — navigator.vibrate([]) called', () => {
      // Given: DebateStream triggers critical vibration
      const { unmount } = render(<DebateStream debateId="test-debate-unit" />);
      const onGuardianInterrupt = capturedSocketOptions.onGuardianInterrupt as (p: Record<string, unknown>) => void;

      act(() => {
        onGuardianInterrupt(guardianInterruptPayload({ riskLevel: 'critical' }));
      });
      mockVibrate.mockClear();

      // When: component unmounts
      unmount();

      // Then: vibration is cancelled with empty array
      expect(mockVibrate).toHaveBeenCalledWith([]);
    });
  });
});
