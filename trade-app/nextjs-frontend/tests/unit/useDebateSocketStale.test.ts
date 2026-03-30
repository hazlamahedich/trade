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
}

describe("[1-6] useDebateSocket Stale Data Handling", () => {
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

  describe("[P0] Stale Data Actions", () => {
    test("[1-6-UNIT-001] should handle DATA_STALE messages @p0", async () => {
      const onDataStale = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
          onDataStale,
        })
      );

      await waitForWebSocket();
      await act(async () => {
        wsInstances[0].simulateOpen();
      });

      await act(async () => {
        wsInstances[0].simulateMessage({
          type: "DEBATE/DATA_STALE",
          payload: {
            debateId: "test-debate-123",
            lastUpdate: "2026-02-19T10:00:00Z",
            ageSeconds: 75,
            message: "Market data is 75 seconds old",
          },
          timestamp: "2026-02-19T10:01:15Z",
        });
      });

      expect(onDataStale).toHaveBeenCalledWith({
        debateId: "test-debate-123",
        lastUpdate: "2026-02-19T10:00:00Z",
        ageSeconds: 75,
        message: "Market data is 75 seconds old",
      });
    });

    test("[1-6-UNIT-002] should handle DATA_REFRESHED messages @p0", async () => {
      const onDataRefreshed = jest.fn();

      renderHook(() =>
        useDebateSocket({
          debateId: "test-debate-123",
          onDataRefreshed,
        })
      );

      await waitForWebSocket();
      await act(async () => {
        wsInstances[0].simulateOpen();
      });

      await act(async () => {
        wsInstances[0].simulateMessage({
          type: "DEBATE/DATA_REFRESHED",
          payload: {
            debateId: "test-debate-123",
            message: "Market data has been refreshed",
          },
          timestamp: "2026-02-19T10:02:00Z",
        });
      });

      expect(onDataRefreshed).toHaveBeenCalledWith({
        debateId: "test-debate-123",
        message: "Market data has been refreshed",
      });
    });
  });
});
