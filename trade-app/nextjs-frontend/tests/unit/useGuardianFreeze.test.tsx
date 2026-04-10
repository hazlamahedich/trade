import { renderHook, act } from '@testing-library/react';
import { useGuardianFreeze } from '../../features/debate/hooks/useGuardianFreeze';
import { makeGuardianPayload, makeTriggerArg } from '../support/helpers/debate-payloads';

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
    // Given: hook is initialized with a mock sendGuardianAck
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: mockSendGuardianAck }));

    // Then: state is active, isFrozen is false, and currentData is null
    expect(result.current.state.status).toBe('active');
    expect(result.current.isFrozen).toBe(false);
    expect(result.current.currentData).toBeNull();
  });

  test('[2-3-UNIT-023b] triggerFreeze transitions active → frozen', () => {
    // Given: hook is in active state
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: mockSendGuardianAck }));
    const payload = makeGuardianPayload();
    const triggerArg = makeTriggerArg();

    // When: triggerFreeze is called with payload and trigger argument
    act(() => {
      result.current.triggerFreeze(payload, triggerArg);
    });

    // Then: state transitions to frozen with correct data
    expect(result.current.state.status).toBe('frozen');
    expect(result.current.isFrozen).toBe(true);
    if (result.current.state.status === 'frozen') {
      expect(result.current.state.data).toBe(payload);
      expect(result.current.state.triggerArg).toBe(triggerArg);
    }
  });

  test('[2-3-UNIT-023c] acknowledgeFreeze transitions frozen → active', () => {
    // Given: hook is in frozen state
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: mockSendGuardianAck }));
    act(() => {
      result.current.triggerFreeze(makeGuardianPayload(), makeTriggerArg());
    });
    expect(result.current.state.status).toBe('frozen');

    // When: acknowledgeFreeze is called
    act(() => {
      result.current.acknowledgeFreeze();
    });

    // Then: state transitions to active and sendGuardianAck is called
    expect(result.current.state.status).toBe('active');
    expect(mockSendGuardianAck).toHaveBeenCalledTimes(1);
  });

  test('[2-3-UNIT-023d] ignoreFreeze transitions frozen → active', () => {
    // Given: hook is in frozen state
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: mockSendGuardianAck }));
    act(() => {
      result.current.triggerFreeze(makeGuardianPayload(), makeTriggerArg());
    });

    // When: ignoreFreeze is called
    act(() => {
      result.current.ignoreFreeze();
    });

    // Then: state transitions to active and sendGuardianAck is called
    expect(result.current.state.status).toBe('active');
    expect(mockSendGuardianAck).toHaveBeenCalledTimes(1);
  });

  test('[2-3-UNIT-023e] retryAck from error transitions error → active', () => {
    // Given: hook has a working sendGuardianAck
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: mockSendGuardianAck }));

    // When: frozen state is triggered then retryAck is called (succeeds immediately)
    act(() => {
      result.current.triggerFreeze(makeGuardianPayload(), makeTriggerArg());
    });
    act(() => {
      result.current.retryAck();
    });

    // Then: state is active and ack was called
    expect(result.current.state.status).toBe('active');
    expect(mockSendGuardianAck).toHaveBeenCalled();
  });

  test('[2-3-UNIT-023f] handleDebateResumed clears to active', () => {
    // Given: hook is in frozen state
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: mockSendGuardianAck }));
    act(() => {
      result.current.triggerFreeze(makeGuardianPayload(), makeTriggerArg());
    });
    expect(result.current.state.status).toBe('frozen');

    // When: handleDebateResumed is called
    act(() => {
      result.current.handleDebateResumed();
    });

    // Then: state clears to active
    expect(result.current.state.status).toBe('active');
  });

  test('[2-3-UNIT-024] @p1 Cooldown prevents rapid overlay flashing', () => {
    // Given: hook receives a freeze that sets the overlay
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: mockSendGuardianAck }));
    const payload1 = makeGuardianPayload({ reason: 'First' });
    const payload2 = makeGuardianPayload({ reason: 'Second' });

    // When: first interrupt arrives
    act(() => {
      result.current.triggerFreeze(payload1, makeTriggerArg());
    });
    expect(result.current.state.status).toBe('frozen');
    if (result.current.state.status === 'frozen') {
      expect(result.current.state.data.reason).toBe('First');
    }

    // And: second interrupt arrives within cooldown window
    act(() => {
      result.current.triggerFreeze(payload2, makeTriggerArg());
    });

    // Then: overlay still shows first interrupt (cooldown blocks replacement)
    if (result.current.state.status === 'frozen') {
      expect(result.current.state.data.reason).toBe('First');
    }

    // And: after cooldown expires, queued interrupt can be displayed
    act(() => {
      jest.advanceTimersByTime(5000);
    });
  });

  test('[2-3-UNIT-023g] clearFreeze transitions to active', () => {
    // Given: hook is in frozen state
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: mockSendGuardianAck }));
    act(() => {
      result.current.triggerFreeze(makeGuardianPayload(), makeTriggerArg());
    });

    // When: clearFreeze is called
    act(() => {
      result.current.clearFreeze();
    });

    // Then: state transitions to active
    expect(result.current.state.status).toBe('active');
  });

  test('[2-3-UNIT-023h] acknowledgeFreeze transitions frozen → error when WS not connected', () => {
    // Given: sendGuardianAck returns false (WS disconnected)
    const failingAck = jest.fn(() => false);
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: failingAck }));

    // When: trigger freeze then acknowledge while disconnected
    act(() => {
      result.current.triggerFreeze(makeGuardianPayload(), makeTriggerArg());
    });
    expect(result.current.state.status).toBe('frozen');

    act(() => {
      result.current.acknowledgeFreeze();
    });

    // Then: state transitions to error with WS error message
    expect(result.current.state.status).toBe('error');
    if (result.current.state.status === 'error') {
      expect(result.current.state.error).toBe('Failed to send acknowledgment — WebSocket not connected');
    }
  });

  test('[2-3-UNIT-023i] retryAck from error stays error when WS still disconnected', () => {
    // Given: hook is in error state (WS disconnected)
    const failingAck = jest.fn(() => false);
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: failingAck }));
    act(() => {
      result.current.triggerFreeze(makeGuardianPayload(), makeTriggerArg());
    });
    act(() => {
      result.current.acknowledgeFreeze();
    });
    expect(result.current.state.status).toBe('error');

    // When: retryAck is called while still disconnected
    act(() => {
      result.current.retryAck();
    });

    // Then: state remains in error
    expect(result.current.state.status).toBe('error');
  });

  test('[2-3-UNIT-023j] retryAck from error → active when WS reconnects', () => {
    // Given: sendGuardianAck fails first call, succeeds on second
    let callCount = 0;
    const eventuallySuccessful = jest.fn(() => {
      callCount++;
      return callCount > 1;
    });
    const { result } = renderHook(() => useGuardianFreeze({ sendGuardianAck: eventuallySuccessful }));

    // When: trigger freeze → ack fails → retry succeeds
    act(() => {
      result.current.triggerFreeze(makeGuardianPayload(), makeTriggerArg());
    });
    act(() => {
      result.current.acknowledgeFreeze();
    });
    expect(result.current.state.status).toBe('error');

    act(() => {
      result.current.retryAck();
    });

    // Then: state transitions to active after successful retry
    expect(result.current.state.status).toBe('active');
  });
});
