import { act, renderHook } from "@testing-library/react";
import { useDebateSocket } from "../../features/debate/hooks/useDebateSocket";
import type { ArgumentPayload } from "../../features/debate/hooks/useDebateSocket";

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

describe("[2-4] useDebateSocket — isRedacted Field Handling", () => {
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
          instance.onmessage({
            data: JSON.stringify(data),
          } as MessageEvent);
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

  function waitForWebSocket(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (wsInstances.length > 0) {
          resolve();
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });
  }

  beforeEach(() => {
    wsInstances = [];
    mockStore = { accessToken: "mock-token-123" };

    Object.defineProperty(global, "localStorage", {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    class MockWS {
      static OPEN = 1;
      static CLOSED = 3;
      static CONNECTING = 0;
      static CLOSING = 2;
      private instance: MockWebSocketInstance;
      constructor(url: string) {
        this.instance = createMockWebSocket(url);
        wsInstances.push(this.instance);
        return this.instance as unknown as MockWS;
      }
      get readyState() { return this.instance.readyState; }
      get url() { return this.instance.url; }
      get onopen() { return this.instance.onopen; }
      set onopen(fn: ((event: Event) => void) | null) { this.instance.onopen = fn; }
      get onclose() { return this.instance.onclose; }
      set onclose(fn: ((event: CloseEvent) => void) | null) { this.instance.onclose = fn; }
      get onmessage() { return this.instance.onmessage; }
      set onmessage(fn: ((event: MessageEvent) => void) | null) { this.instance.onmessage = fn; }
      get onerror() { return this.instance.onerror; }
      set onerror(fn: ((event: Event) => void) | null) { this.instance.onerror = fn; }
      send = (...args: Parameters<jest.Mock>) => this.instance.send(...args);
      close = (...args: Parameters<jest.Mock>) => this.instance.close(...args);
    }

    global.WebSocket = MockWS as unknown as typeof WebSocket;
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    mockStore = {};
  });

  describe("[P0] isRedacted Field in ARGUMENT_COMPLETE", () => {
    test("[2-4-UNIT-001] receives isRedacted=true from ARGUMENT_COMPLETE @p0", async () => {
      const onArgumentComplete = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-redacted",
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
            debateId: "test-debate-redacted",
            agent: "bull",
            content: "This is a [REDACTED] profit opportunity.",
            turn: 1,
            isRedacted: true,
          },
          timestamp: "2024-01-01T00:00:00Z",
        });
      });

      expect(onArgumentComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          isRedacted: true,
          content: expect.stringContaining("[REDACTED]"),
        })
      );
    });

    test("[2-4-UNIT-002] receives isRedacted=false for clean arguments @p0", async () => {
      const onArgumentComplete = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-clean",
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
            debateId: "test-debate-clean",
            agent: "bear",
            content: "Market risks remain elevated.",
            turn: 1,
            isRedacted: false,
          },
          timestamp: "2024-01-01T00:00:00Z",
        });
      });

      expect(onArgumentComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          isRedacted: false,
        })
      );
    });

    test("[2-4-UNIT-003] handles missing isRedacted gracefully (backward compat) @p0", async () => {
      const onArgumentComplete = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-legacy",
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
            debateId: "test-debate-legacy",
            agent: "bull",
            content: "Standard argument without isRedacted field.",
            turn: 1,
          },
          timestamp: "2024-01-01T00:00:00Z",
        });
      });

      expect(onArgumentComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Standard argument without isRedacted field.",
        })
      );
    });

    test("[2-4-UNIT-004] ArgumentPayload type includes isRedacted optional field @p0", () => {
      const payloadWithRedaction: ArgumentPayload = {
        debateId: "deb-1",
        agent: "bull",
        content: "[REDACTED] content",
        turn: 1,
        isRedacted: true,
      };

      const payloadWithoutRedaction: ArgumentPayload = {
        debateId: "deb-2",
        agent: "bear",
        content: "Clean content",
      };

      expect(payloadWithRedaction.isRedacted).toBe(true);
      expect(payloadWithoutRedaction.isRedacted).toBeUndefined();
    });
  });

  describe("[P1] Redacted Content Handling Patterns", () => {
    test("[2-4-UNIT-005] multiple redacted arguments across turns @p1", async () => {
      const onArgumentComplete = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-multi",
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
            debateId: "test-debate-multi",
            agent: "bull",
            content: "This is [REDACTED] and [REDACTED].",
            turn: 1,
            isRedacted: true,
          },
          timestamp: "2024-01-01T00:00:00Z",
        });
      });

      await act(async () => {
        wsInstances[0].simulateMessage({
          type: "DEBATE/ARGUMENT_COMPLETE",
          payload: {
            debateId: "test-debate-multi",
            agent: "bear",
            content: "However, risks are significant.",
            turn: 2,
            isRedacted: false,
          },
          timestamp: "2024-01-01T00:00:00Z",
        });
      });

      expect(onArgumentComplete).toHaveBeenCalledTimes(2);
      expect(onArgumentComplete).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ isRedacted: true, agent: "bull" })
      );
      expect(onArgumentComplete).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ isRedacted: false, agent: "bear" })
      );
    });
  });
});
