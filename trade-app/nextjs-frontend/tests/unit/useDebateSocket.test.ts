import { act, renderHook } from "@testing-library/react";
import { useDebateSocket } from "../../features/debate/hooks/useDebateSocket";

interface MockWebSocketInstance {
  readyState: number;
  url: string;
  onopen: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  send: jest.Mock;
  close: jest.Mock;
  simulateOpen: () => void;
  simulateMessage: (data: unknown) => void;
  simulateClose: (code?: number, reason?: string) => void;
  simulateError: () => void;
}

describe("[1-4] useDebateSocket Hook Unit Tests", () => {
  let wsInstances: MockWebSocketInstance[] = [];
  const originalWebSocket = global.WebSocket;
  let mockStore: Record<string, string> = {};

  const mockLocalStorage = {
    getItem: jest.fn((key: string) => mockStore[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      mockStore[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStore[key];
    }),
    clear: jest.fn(() => {
      mockStore = {};
    }),
    get length() {
      return Object.keys(mockStore).length;
    },
    key: jest.fn((index: number) => Object.keys(mockStore)[index] || null),
  };

  function createMockWebSocket(url: string): MockWebSocketInstance {
    const instance: MockWebSocketInstance = {
      readyState: 0,
      url,
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
      send: jest.fn(),
      close: jest.fn((code = 1000, reason = "") => {
        instance.readyState = 3;
        if (instance.onclose) {
          instance.onclose({ code, reason } as CloseEvent);
        }
      }),
      simulateOpen: () => {
        instance.readyState = 1;
        if (instance.onopen) {
          instance.onopen(new Event("open"));
        }
      },
      simulateMessage: (data: unknown) => {
        if (instance.onmessage) {
          instance.onmessage({ data: JSON.stringify(data) } as MessageEvent);
        }
      },
      simulateClose: (code = 1000, reason = "") => {
        instance.readyState = 3;
        if (instance.onclose) {
          instance.onclose({ code, reason } as CloseEvent);
        }
      },
      simulateError: () => {
        if (instance.onerror) {
          instance.onerror(new Event("error"));
        }
      },
    };
    return instance;
  }

  beforeEach(() => {
    wsInstances = [];
    mockStore = { accessToken: "mock-token-123" };
    jest.useFakeTimers();

    Object.defineProperty(global, "localStorage", {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    class MockWebSocketClass {
      private instance: MockWebSocketInstance;

      constructor(url: string) {
        this.instance = createMockWebSocket(url);
        wsInstances.push(this.instance);
        return this.instance as unknown as MockWebSocketClass;
      }

      get readyState() {
        return this.instance.readyState;
      }
      get url() {
        return this.instance.url;
      }
      get onopen() {
        return this.instance.onopen;
      }
      set onopen(fn: ((event: Event) => void) | null) {
        this.instance.onopen = fn;
      }
      get onclose() {
        return this.instance.onclose;
      }
      set onclose(fn: ((event: CloseEvent) => void) | null) {
        this.instance.onclose = fn;
      }
      get onmessage() {
        return this.instance.onmessage;
      }
      set onmessage(fn: ((event: MessageEvent) => void) | null) {
        this.instance.onmessage = fn;
      }
      get onerror() {
        return this.instance.onerror;
      }
      set onerror(fn: ((event: Event) => void) | null) {
        this.instance.onerror = fn;
      }
      send = (...args: Parameters<jest.Mock>) => this.instance.send(...args);
      close = (...args: Parameters<jest.Mock>) => this.instance.close(...args);
    }

    global.WebSocket = MockWebSocketClass as unknown as typeof WebSocket;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllTimers();
    global.WebSocket = originalWebSocket;
    mockStore = {};
  });

  async function waitForWebSocket(): Promise<void> {
    await act(async () => {
      await jest.runAllTimersAsync();
    });
  }

  describe("[P0] Critical Path", () => {
    test("[1-4-UNIT-001] should initialize with disconnected status @p0", () => {
      const { result } = renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
        })
      );

      expect(result.current.status).toBe("disconnected");
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.isDisconnected).toBe(true);
    });

    test("[1-4-UNIT-002] should connect to WebSocket with valid token @p0", async () => {
      const { result } = renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
        })
      );

      await waitForWebSocket();

      expect(wsInstances.length).toBe(1);
      expect(wsInstances[0].url).toContain("test-debate-123");
      expect(wsInstances[0].url).toContain("token=mock-token-123");

      await act(async () => {
        wsInstances[0].simulateOpen();
      });

      expect(result.current.status).toBe("connected");
      expect(result.current.isConnected).toBe(true);
    });

    test("[1-4-UNIT-003] should handle TOKEN_RECEIVED messages @p0", async () => {
      const onTokenReceived = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
          onTokenReceived,
        })
      );

      await waitForWebSocket();
      await act(async () => {
        wsInstances[0].simulateOpen();
      });

      await act(async () => {
        wsInstances[0].simulateMessage({
          type: "DEBATE/TOKEN_RECEIVED",
          payload: {
            debateId: "test-debate-123",
            agent: "bull",
            token: "Hello",
            turn: 1,
          },
          timestamp: "2024-01-01T00:00:00Z",
        });
      });

      expect(onTokenReceived).toHaveBeenCalledWith({
        debateId: "test-debate-123",
        agent: "bull",
        token: "Hello",
        turn: 1,
      });
    });

    test("[1-4-UNIT-004] should handle ARGUMENT_COMPLETE messages @p0", async () => {
      const onArgumentComplete = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
          onArgumentComplete,
        })
      );

      await waitForWebSocket();
      await act(async () => {
        wsInstances[0].simulateOpen();
      });

      await act(async () => {
        wsInstances[0].simulateMessage({
          type: "DEBATE/ARGUMENT_COMPLETE",
          payload: {
            debateId: "test-debate-123",
            agent: "bull",
            content: "Full argument text",
            turn: 1,
          },
          timestamp: "2024-01-01T00:00:00Z",
        });
      });

      expect(onArgumentComplete).toHaveBeenCalledWith({
        debateId: "test-debate-123",
        agent: "bull",
        content: "Full argument text",
        turn: 1,
      });
    });
  });

  describe("[P1] Connection Management", () => {
    test("[1-4-UNIT-005] should handle CONNECTED event @p1", async () => {
      const onConnected = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
          onConnected,
        })
      );

      await waitForWebSocket();
      await act(async () => {
        wsInstances[0].simulateOpen();
      });

      expect(onConnected).toHaveBeenCalled();
    });

    test("[1-4-UNIT-006] should handle DISCONNECTED event @p1", async () => {
      const onDisconnected = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
          onDisconnected,
        })
      );

      await waitForWebSocket();
      await act(async () => {
        wsInstances[0].simulateOpen();
        wsInstances[0].simulateClose();
      });

      expect(onDisconnected).toHaveBeenCalled();
    });

    test("[1-4-UNIT-007] should handle explicit disconnect @p1", async () => {
      const { result } = renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
        })
      );

      await waitForWebSocket();
      await act(async () => {
        wsInstances[0].simulateOpen();
      });

      await act(async () => {
        result.current.disconnect();
      });

      expect(wsInstances[0].close).toHaveBeenCalledWith(1000, "Client disconnect");
      expect(result.current.status).toBe("disconnected");
    });

    test("[1-4-UNIT-008] should handle manual reconnect @p1", async () => {
      const { result } = renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
        })
      );

      await waitForWebSocket();
      await act(async () => {
        wsInstances[0].simulateOpen();
      });

      expect(wsInstances.length).toBe(1);

      await act(async () => {
        result.current.reconnect();
        await jest.runAllTimersAsync();
      });

      expect(wsInstances.length).toBe(2);
    });
  });

  describe("[P1] Error Handling", () => {
    test("[1-4-UNIT-009] should handle ERROR messages @p1", async () => {
      const onError = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
          onError,
        })
      );

      await waitForWebSocket();
      await act(async () => {
        wsInstances[0].simulateOpen();
      });

      await act(async () => {
        wsInstances[0].simulateMessage({
          type: "DEBATE/ERROR",
          payload: {
            code: "DEBATE_NOT_FOUND",
            message: "Debate does not exist",
          },
          timestamp: "2024-01-01T00:00:00Z",
        });
      });

      expect(onError).toHaveBeenCalledWith({
        code: "DEBATE_NOT_FOUND",
        message: "Debate does not exist",
      });
    });

    test("[1-4-UNIT-010] should handle no token error @p1", async () => {
      mockStore = {};

      const onError = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
          onError,
        })
      );

      await waitForWebSocket();

      expect(onError).toHaveBeenCalledWith({
        code: "NO_TOKEN",
        message: "No authentication token available",
      });
    });

    test("[1-4-UNIT-011] should handle WebSocket close with error code @p1", async () => {
      const onError = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
          onError,
          maxRetries: 0,
        })
      );

      await waitForWebSocket();
      await act(async () => {
        wsInstances[0].simulateOpen();
        wsInstances[0].simulateClose(4001, "Unauthorized");
      });

      expect(onError).toHaveBeenCalledWith({
        code: "WS_4001",
        message: "Unauthorized",
      });
    });
  });

  describe("[P1] Reconnection", () => {
    test("[1-4-UNIT-012] should attempt reconnection with exponential backoff @p1", async () => {
      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
          maxRetries: 3,
        })
      );

      await waitForWebSocket();
      await act(async () => {
        wsInstances[0].simulateOpen();
      });

      expect(wsInstances.length).toBe(1);

      await act(async () => {
        wsInstances[0].simulateClose(1006, "Abnormal closure");
        jest.advanceTimersByTime(1000);
        await jest.runAllTimersAsync();
      });

      expect(wsInstances.length).toBe(2);
    });

    test("[1-4-UNIT-013] should stop reconnecting after max retries @p1", async () => {
      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
          maxRetries: 2,
        })
      );

      await waitForWebSocket();
      await act(async () => {
        wsInstances[0].simulateOpen();
      });

      await act(async () => {
        wsInstances[0].simulateClose(1006, "Abnormal closure");
        jest.advanceTimersByTime(1000);
        await jest.runAllTimersAsync();
      });

      expect(wsInstances.length).toBe(2);

      await act(async () => {
        if (wsInstances[1]) wsInstances[1].simulateClose(1006, "Abnormal closure");
        jest.advanceTimersByTime(2000);
        await jest.runAllTimersAsync();
      });

      expect(wsInstances.length).toBe(3);

      await act(async () => {
        if (wsInstances[2]) wsInstances[2].simulateClose(1006, "Abnormal closure");
        jest.runAllTimers();
      });

      expect(wsInstances.length).toBe(3);
    });
  });

  describe("[P2] Message Handling", () => {
    test("[1-4-UNIT-014] should handle TURN_CHANGE messages @p2", async () => {
      const onTurnChange = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
          onTurnChange,
        })
      );

      await waitForWebSocket();
      await act(async () => {
        wsInstances[0].simulateOpen();
      });

      await act(async () => {
        wsInstances[0].simulateMessage({
          type: "DEBATE/TURN_CHANGE",
          payload: {
            debateId: "test-debate-123",
            currentAgent: "bear",
          },
          timestamp: "2024-01-01T00:00:00Z",
        });
      });

      expect(onTurnChange).toHaveBeenCalledWith({
        debateId: "test-debate-123",
        currentAgent: "bear",
      });
    });

    test("[1-4-UNIT-015] should handle STATUS_UPDATE messages @p2", async () => {
      const onStatusUpdate = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
          onStatusUpdate,
        })
      );

      await waitForWebSocket();
      await act(async () => {
        wsInstances[0].simulateOpen();
      });

      await act(async () => {
        wsInstances[0].simulateMessage({
          type: "DEBATE/STATUS_UPDATE",
          payload: {
            debateId: "test-debate-123",
            status: "completed",
          },
          timestamp: "2024-01-01T00:00:00Z",
        });
      });

      expect(onStatusUpdate).toHaveBeenCalledWith({
        debateId: "test-debate-123",
        status: "completed",
      });
    });

    test("[1-4-UNIT-016] should respond to PING with PONG @p2", async () => {
      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
        })
      );

      await waitForWebSocket();
      await act(async () => {
        wsInstances[0].simulateOpen();
      });

      await act(async () => {
        wsInstances[0].simulateMessage({
          type: "DEBATE/PING",
          payload: {},
          timestamp: "2024-01-01T00:00:00Z",
        });
      });

      expect(wsInstances[0].send).toHaveBeenCalledWith(JSON.stringify({ type: "DEBATE/PONG" }));
    });

    test("[1-4-UNIT-017] should handle malformed messages gracefully @p2", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const onTokenReceived = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
          onTokenReceived,
        })
      );

      await waitForWebSocket();
      await act(async () => {
        wsInstances[0].simulateOpen();
      });

      await act(async () => {
        if (wsInstances[0].onmessage) {
          wsInstances[0].onmessage({ data: "invalid json" } as MessageEvent);
        }
      });

      expect(onTokenReceived).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("[P2] Cleanup", () => {
    test("[1-4-UNIT-018] should cleanup on unmount @p2", async () => {
      const { unmount } = renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
        })
      );

      await waitForWebSocket();
      await act(async () => {
        wsInstances[0].simulateOpen();
      });

      unmount();

      expect(wsInstances[0].close).toHaveBeenCalled();
    });

    test("[1-4-UNIT-019] should clear reconnect timeout on disconnect @p2", async () => {
      const { result } = renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
          maxRetries: 5,
        })
      );

      await waitForWebSocket();
      await act(async () => {
        wsInstances[0].simulateOpen();
        wsInstances[0].simulateClose(1006, "Abnormal closure");
      });

      const wsCountBeforeDisconnect = wsInstances.length;

      await act(async () => {
        result.current.disconnect();
        jest.runAllTimers();
      });

      const wsCountAfterDisconnect = wsInstances.length;

      await act(async () => {
        jest.advanceTimersByTime(10000);
      });

      expect(wsInstances.length).toBe(wsCountAfterDisconnect);
      expect(wsCountAfterDisconnect).toBe(wsCountBeforeDisconnect);
    });
  });
});
