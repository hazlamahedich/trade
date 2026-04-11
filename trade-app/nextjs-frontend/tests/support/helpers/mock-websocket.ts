export interface MockWebSocketInstance {
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

class MockWebSocketClass {
  static OPEN = 1;
  static CLOSED = 3;
  static CONNECTING = 0;
  static CLOSING = 2;

  private instance: MockWebSocketInstance;

  constructor(url: string) {
    this.instance = createMockWebSocket(url);
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

export function createMockWebSocketSetup() {
  const wsInstances: MockWebSocketInstance[] = [];
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

  function install(): void {
    wsInstances.length = 0;
    mockStore = { accessToken: "mock-token-123" };

    Object.defineProperty(global, "localStorage", {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    global.WebSocket = MockWebSocketClass as unknown as typeof WebSocket;
  }

  function cleanup(): void {
    global.WebSocket = originalWebSocket;
    mockStore = {};
  }

  function getInstances(): MockWebSocketInstance[] {
    return wsInstances;
  }

  async function waitForInstance(): Promise<MockWebSocketInstance> {
    await new Promise<void>((resolve) => {
      const check = () => {
        if (wsInstances.length > 0) resolve();
        else setTimeout(check, 0);
      };
      check();
    });
    return wsInstances[0];
  }

  const MockWS = class extends MockWebSocketClass {
    constructor(url: string) {
      super(url);
      wsInstances.push(this as unknown as MockWebSocketInstance);
    }
  };

  function installWithTracking(): void {
    wsInstances.length = 0;
    mockStore = { accessToken: "mock-token-123" };

    Object.defineProperty(global, "localStorage", {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    global.WebSocket = MockWS as unknown as typeof WebSocket;
  }

  return {
    install: installWithTracking,
    cleanup,
    getInstances,
    waitForInstance,
    mockLocalStorage,
    mockStore: () => mockStore,
  };
}
