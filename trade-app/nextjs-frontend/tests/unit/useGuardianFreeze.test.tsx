import { renderHook, act } from '@testing-library/react';
import { useGuardianFreeze } from '../../features/debate/hooks/useGuardianFreeze';
import type { GuardianInterruptPayload } from '../../features/debate/hooks/useDebateSocket';

function makePayload(overrides: Partial<GuardianInterruptPayload> = {}): GuardianInterruptPayload {
  return {
    debateId: 'd1',
    riskLevel: 'high',
    reason: 'Detected bias',
    fallacyType: 'anchoring_bias',
    originalAgent: 'bull',
    summaryVerdict: 'High Risk',
    turn: 1,
    ...overrides,
  };
}

function makeTriggerArg() {
  return {
    id: 'arg-1',
    type: 'argument' as const,
    agent: 'bull' as const,
    content: 'Test argument content',
    timestamp: '2026-04-10T12:00:00Z',
  };
}

describe('[2-3] useGuardianFreeze — Hook Tests', () => {
  const mockSendGuardianAck = jest.fn(() => true);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('[2-3-UNIT-023a] Initial state is active', () => {
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: mockSendGuardianAck }));
    expect(result.current.state.status).toBe('active');
    expect(result.current.isFrozen).toBe(false);
    expect(result.current.currentData).toBeNull();
  });

  test('[2-3-UNIT-023b] triggerFreeze transitions active → frozen', () => {
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: mockSendGuardianAck }));
    const payload = makePayload();
    const triggerArg = makeTriggerArg();

    act(() => {
      result.current.triggerFreeze(payload, triggerArg);
    });

    expect(result.current.state.status).toBe('frozen');
    expect(result.current.isFrozen).toBe(true);
    if (result.current.state.status === 'frozen') {
      expect(result.current.state.data).toBe(payload);
      expect(result.current.state.triggerArg).toBe(triggerArg);
    }
  });

  test('[2-3-UNIT-023c] acknowledgeFreeze transitions frozen → active', () => {
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: mockSendGuardianAck }));

    act(() => {
      result.current.triggerFreeze(makePayload(), makeTriggerArg());
    });
    expect(result.current.state.status).toBe('frozen');

    act(() => {
      result.current.acknowledgeFreeze();
    });
    expect(result.current.state.status).toBe('active');
    expect(mockSendGuardianAck).toHaveBeenCalledTimes(1);
  });

  test('[2-3-UNIT-023d] ignoreFreeze transitions frozen → active', () => {
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: mockSendGuardianAck }));

    act(() => {
      result.current.triggerFreeze(makePayload(), makeTriggerArg());
    });

    act(() => {
      result.current.ignoreFreeze();
    });
    expect(result.current.state.status).toBe('active');
    expect(mockSendGuardianAck).toHaveBeenCalledTimes(1);
  });

  test('[2-3-UNIT-023e] retryAck from error transitions error → active', () => {
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: mockSendGuardianAck }));

    act(() => {
      result.current.triggerFreeze(makePayload(), makeTriggerArg());
    });

    act(() => {
      result.current.retryAck();
    });
    expect(result.current.state.status).toBe('active');
    expect(mockSendGuardianAck).toHaveBeenCalled();
  });

  test('[2-3-UNIT-023f] handleDebateResumed clears to active', () => {
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: mockSendGuardianAck }));

    act(() => {
      result.current.triggerFreeze(makePayload(), makeTriggerArg());
    });
    expect(result.current.state.status).toBe('frozen');

    act(() => {
      result.current.handleDebateResumed();
    });
    expect(result.current.state.status).toBe('active');
  });

  test('[2-3-UNIT-024] @p1 Cooldown prevents rapid overlay flashing', () => {
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: mockSendGuardianAck }));
    const payload1 = makePayload({ reason: 'First' });
    const payload2 = makePayload({ reason: 'Second' });

    act(() => {
      result.current.triggerFreeze(payload1, makeTriggerArg());
    });
    expect(result.current.state.status).toBe('frozen');
    if (result.current.state.status === 'frozen') {
      expect(result.current.state.data.reason).toBe('First');
    }

    act(() => {
      result.current.triggerFreeze(payload2, makeTriggerArg());
    });
    if (result.current.state.status === 'frozen') {
      expect(result.current.state.data.reason).toBe('First');
    }

    act(() => {
      jest.advanceTimersByTime(5000);
    });
  });

  test('[2-3-UNIT-023g] clearFreeze transitions to active', () => {
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: mockSendGuardianAck }));

    act(() => {
      result.current.triggerFreeze(makePayload(), makeTriggerArg());
    });

    act(() => {
      result.current.clearFreeze();
    });
    expect(result.current.state.status).toBe('active');
  });

  test('[2-3-UNIT-023h] acknowledgeFreeze transitions frozen → error when WS not connected', () => {
    const failingAck = jest.fn(() => false);
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: failingAck }));

    act(() => {
      result.current.triggerFreeze(makePayload(), makeTriggerArg());
    });
    expect(result.current.state.status).toBe('frozen');

    act(() => {
      result.current.acknowledgeFreeze();
    });
    expect(result.current.state.status).toBe('error');
    if (result.current.state.status === 'error') {
      expect(result.current.state.error).toBe('Failed to send acknowledgment — WebSocket not connected');
    }
  });

  test('[2-3-UNIT-023i] retryAck from error stays error when WS still disconnected', () => {
    const failingAck = jest.fn(() => false);
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: failingAck }));

    act(() => {
      result.current.triggerFreeze(makePayload(), makeTriggerArg());
    });

    act(() => {
      result.current.acknowledgeFreeze();
    });
    expect(result.current.state.status).toBe('error');

    act(() => {
      result.current.retryAck();
    });
    expect(result.current.state.status).toBe('error');
  });

  test('[2-3-UNIT-023j] retryAck from error → active when WS reconnects', () => {
    let callCount = 0;
    const eventuallySuccessful = jest.fn(() => {
      callCount++;
      return callCount > 1;
    });
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: eventuallySuccessful }));

    act(() => {
      result.current.triggerFreeze(makePayload(), makeTriggerArg());
    });

    act(() => {
      result.current.acknowledgeFreeze();
    });
    expect(result.current.state.status).toBe('error');

    act(() => {
      result.current.retryAck();
    });
    expect(result.current.state.status).toBe('active');
  });
});
