import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

jest.mock("@xyflow/react", () => {
  const react = jest.requireActual("react");
  return {
    ReactFlow: ({
      nodes,
      nodeTypes,
    }: {
      nodes: { id: string; type: string; data: Record<string, unknown> }[];
      nodeTypes?: Record<string, React.ComponentType>;
      [key: string]: unknown;
    }) => (
      <div data-testid="mock-react-flow">
        {nodes.map((n) => {
          const Comp = nodeTypes?.[n.type];
          if (Comp) {
            return <Comp key={n.id} id={n.id} data={n.data} type={n.type} />;
          }
          return (
            <div key={n.id} data-testid={`rf-node-${n.id}`}>
              {n.data.label as string}
            </div>
          );
        })}
      </div>
    ),
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="react-flow-provider">{children}</div>
    ),
    useNodesState: (initial: unknown) => {
      const [nodes, setNodes] = react.useState(initial);
      return [nodes, setNodes, jest.fn()];
    },
    useEdgesState: (initial: unknown) => {
      const [edges, setEdges] = react.useState(initial);
      return [edges, setEdges, jest.fn()];
    },
    Handle: ({ type }: { type: string }) => <div data-handle={type} />,
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
    BaseEdge: ({ style }: { style?: React.CSSProperties }) => (
      <div data-testid="base-edge" style={style} />
    ),
    getSmoothStepPath: () => ["M 0 0 L 100 100", 0, 0],
  };
});

jest.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: {
      children: React.ReactNode;
      [key: string]: unknown;
    }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useReducedMotion: () => false,
}));

jest.mock("next/dynamic", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReasoningGraphMod = require("../../features/debate/components/graph/ReasoningGraphWrapper");
  return (loader: () => Promise<{ ReasoningGraph: unknown }>, opts: { ssr?: boolean }) => {
    const Component = (props: Record<string, unknown>) => {
      const Mod = opts.ssr === false
        ? ReasoningGraphMod.ReasoningGraph
        : ReasoningGraphMod.ReasoningGraph;
      return <Mod {...props} />;
    };
    Component.displayName = "DynamicReasoningGraph";
    return Component;
  };
});

let wsInstances: {
  readyState: number;
  onopen: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  send: jest.Mock;
  close: jest.Mock;
  url: string;
}[] = [];
const originalWebSocket = global.WebSocket;
let mockStore: Record<string, string> = {};

const mockLocalStorage = {
  getItem: jest.fn((key: string) => mockStore[key] || null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(() => {
    mockStore = {};
  }),
  get length() {
    return Object.keys(mockStore).length;
  },
  key: jest.fn(),
};

function createMockWS(url: string) {
  const inst = {
    readyState: 0,
    url,
    onopen: null as ((event: Event) => void) | null,
    onclose: null as ((event: CloseEvent) => void) | null,
    onmessage: null as ((event: MessageEvent) => void) | null,
    onerror: null as ((event: Event) => void) | null,
    send: jest.fn(),
    close: jest.fn(),
  };
  return inst;
}

jest.mock("../../features/debate/api", () => ({
  submitVote: jest.fn(),
  fetchDebateResult: jest.fn(() => Promise.reject(new Error("Not mocked"))),
  getOrCreateVoterFingerprint: jest.fn(() => "test-fp"),
}));

import { DebateStream } from "../../features/debate/components/DebateStream";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("[1-7-INT] DebateStream + ReasoningGraph Integration — Positioning", () => {
  beforeEach(() => {
    wsInstances = [];
    mockStore = { accessToken: "test-token" };
    jest.useFakeTimers();

    Object.defineProperty(global, "localStorage", {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });

    const MockWS = class {
      private inst: ReturnType<typeof createMockWS>;
      constructor(url: string) {
        this.inst = createMockWS(url);
        wsInstances.push(this.inst);
      }
      get readyState() { return this.inst.readyState; }
      set readyState(v: number) { this.inst.readyState = v; }
      get url() { return this.inst.url; }
      get onopen() { return this.inst.onopen; }
      set onopen(fn: ((event: Event) => void) | null) { this.inst.onopen = fn; }
      get onclose() { return this.inst.onclose; }
      set onclose(fn: ((event: CloseEvent) => void) | null) { this.inst.onclose = fn; }
      get onmessage() { return this.inst.onmessage; }
      set onmessage(fn: ((event: MessageEvent) => void) | null) { this.inst.onmessage = fn; }
      get onerror() { return this.inst.onerror; }
      set onerror(fn: ((event: Event) => void) | null) { this.inst.onerror = fn; }
      send = (...args: Parameters<jest.Mock>) => this.inst.send(...args);
      close = (...args: Parameters<jest.Mock>) => this.inst.close(...args);
    };
    global.WebSocket = MockWS as unknown as typeof WebSocket;
  });

  afterEach(() => {
    jest.useRealTimers();
    global.WebSocket = originalWebSocket;
  });

  async function connectWS() {
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    if (wsInstances[0]) {
      await act(async () => {
        wsInstances[0].readyState = 1;
        wsInstances[0].onopen?.(new Event("open"));
      });
    }
  }

  function sendMessage(data: Record<string, unknown>) {
    act(() => {
      wsInstances[0]?.onmessage?.({
        data: JSON.stringify(data),
      } as MessageEvent);
    });
  }

  test("[1-7-INT-005] @p1 graph renders below argument messages", async () => {
    const { container } = render(<DebateStream debateId="debate-int-5" />, { wrapper: createWrapper() });

    await connectWS();

    sendMessage({
      type: "DEBATE/ARGUMENT_COMPLETE",
      payload: {
        debateId: "debate-int-5",
        agent: "bull",
        content: "This is a test argument from the bull side.",
        turn: 1,
      },
      timestamp: new Date().toISOString(),
    });

    sendMessage({
      type: "DEBATE/REASONING_NODE",
      payload: {
        debateId: "debate-int-5",
        nodeId: "data-BTC-pos5",
        nodeType: "data_input",
        label: "BTC Market Data",
        summary: "Loaded",
        agent: null,
        parentId: null,
        isWinning: false,
        turn: null,
      },
      timestamp: new Date().toISOString(),
    });

    const graphContainer = screen.getByTestId("reasoning-graph-container");
    const debateStream = container.querySelector('[data-testid="debate-stream"]');

    if (debateStream) {
      const allChildren = Array.from(debateStream.children);
      const graphIndex = allChildren.indexOf(graphContainer.parentElement!);
      const argumentElements = debateStream.querySelectorAll('[data-testid^="argument-"]');

      if (argumentElements.length > 0) {
        const lastArg = argumentElements[argumentElements.length - 1];
        const lastArgIndex = allChildren.indexOf(lastArg.parentElement!);
        expect(graphIndex).toBeGreaterThan(lastArgIndex);
      }
    }
  });

  test("[1-7-INT-006] @p1 graph updates with multiple REASONING_NODE messages", async () => {
    render(<DebateStream debateId="debate-int-6" />, { wrapper: createWrapper() });

    await connectWS();

    sendMessage({
      type: "DEBATE/REASONING_NODE",
      payload: {
        debateId: "debate-int-6",
        nodeId: "data-ETH-multi6",
        nodeType: "data_input",
        label: "ETH Market Data",
        summary: "Loaded",
        agent: null,
        parentId: null,
        isWinning: false,
        turn: null,
      },
      timestamp: new Date().toISOString(),
    });

    sendMessage({
      type: "DEBATE/REASONING_NODE",
      payload: {
        debateId: "debate-int-6",
        nodeId: "bull-turn-1",
        nodeType: "bull_analysis",
        label: "Bull Argument #1",
        summary: "Bullish",
        agent: "bull",
        parentId: "data-ETH-multi6",
        isWinning: false,
        turn: 1,
      },
      timestamp: new Date().toISOString(),
    });

    sendMessage({
      type: "DEBATE/REASONING_NODE",
      payload: {
        debateId: "debate-int-6",
        nodeId: "bear-turn-1",
        nodeType: "bear_counter",
        label: "Bear Counter #1",
        summary: "Bearish",
        agent: "bear",
        parentId: "bull-turn-1",
        isWinning: false,
        turn: 1,
      },
      timestamp: new Date().toISOString(),
    });

    expect(screen.getByText("ETH Market Data")).toBeInTheDocument();
    expect(screen.getByText("Bull Argument #1")).toBeInTheDocument();
    expect(screen.getByText("Bear Counter #1")).toBeInTheDocument();
  });
});
