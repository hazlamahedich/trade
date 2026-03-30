jest.mock("@xyflow/react", () => {
  const react = jest.requireActual("react");
  return {
    useNodesState: (initial: unknown) => {
      const [nodes, setNodes] = react.useState(initial);
      const onNodesChange = jest.fn();
      return [nodes, setNodes, onNodesChange];
    },
    useEdgesState: (initial: unknown) => {
      const [edges, setEdges] = react.useState(initial);
      const onEdgesChange = jest.fn();
      return [edges, setEdges, onEdgesChange];
    },
  };
});

import { renderHook } from "@testing-library/react";
import { useReasoningGraph } from "../../features/debate/hooks/useReasoningGraph";

interface ReasoningNodePayload {
  debateId: string;
  nodeId: string;
  nodeType: "data_input" | "bull_analysis" | "bear_counter" | "risk_check";
  label: string;
  summary: string;
  agent: "bull" | "bear" | null;
  parentId: string | null;
  isWinning: boolean;
  turn: number | null;
}

const dataInputPayload: ReasoningNodePayload = {
  debateId: "debate-1",
  nodeId: "data-BTC-abc12345",
  nodeType: "data_input",
  label: "BTC Market Data",
  summary: "Market data loaded",
  agent: null,
  parentId: null,
  isWinning: false,
  turn: null,
};

const bullPayload: ReasoningNodePayload = {
  debateId: "debate-1",
  nodeId: "bull-turn-1",
  nodeType: "bull_analysis",
  label: "Bull Argument #1",
  summary: "Strong bullish case",
  agent: "bull",
  parentId: "data-BTC-abc12345",
  isWinning: false,
  turn: 1,
};

const bearPayload: ReasoningNodePayload = {
  debateId: "debate-1",
  nodeId: "bear-turn-1",
  nodeType: "bear_counter",
  label: "Bear Counter #1",
  summary: "Bearish counter",
  agent: "bear",
  parentId: "bull-turn-1",
  isWinning: false,
  turn: 1,
};

describe("[1-7-UNIT] useReasoningGraph Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("[1-7-UNIT-001] @p0 creates data input node from REASONING_NODE payload", () => {
    const { result } = renderHook(() => useReasoningGraph([dataInputPayload]));

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0].id).toBe("data-BTC-abc12345");
    expect(result.current.nodes[0].type).toBe("dataInput");
    expect(result.current.nodes[0].data.label).toBe("BTC Market Data");
    expect(result.current.nodes[0].data.isWinning).toBe(false);
    expect(result.current.edges).toHaveLength(0);
  });

  test("[1-7-UNIT-002] @p0 adds agent analysis nodes from REASONING_NODE payloads", () => {
    const { result } = renderHook(() =>
      useReasoningGraph([dataInputPayload, bullPayload])
    );

    expect(result.current.nodes).toHaveLength(2);

    const bullNode = result.current.nodes.find((n: { id: string }) => n.id === "bull-turn-1");
    expect(bullNode).toBeDefined();
    expect(bullNode!.type).toBe("agentAnalysis");
    expect(bullNode!.data.label).toBe("Bull Argument #1");

    expect(result.current.edges).toHaveLength(1);
    expect(result.current.edges[0].source).toBe("data-BTC-abc12345");
    expect(result.current.edges[0].target).toBe("bull-turn-1");
  });

  test("[1-7-UNIT-003] @p0 highlights winning nodes/edges when isWinning=true", () => {
    const winningPayload: ReasoningNodePayload = {
      ...bullPayload,
      isWinning: true,
    };

    const { result } = renderHook(() =>
      useReasoningGraph([dataInputPayload, bullPayload, winningPayload])
    );

    const bullNode = result.current.nodes.find((n: { id: string }) => n.id === "bull-turn-1");
    expect(bullNode!.data.isWinning).toBe(true);
  });

  test("[1-7-UNIT-004] @p0 handles duplicate node IDs without duplicating nodes", () => {
    const { result } = renderHook(() =>
      useReasoningGraph([dataInputPayload, dataInputPayload])
    );

    expect(result.current.nodes).toHaveLength(1);
  });

  test("[1-7-UNIT-005] @p0 creates bear counter node with correct type", () => {
    const { result } = renderHook(() =>
      useReasoningGraph([dataInputPayload, bullPayload, bearPayload])
    );

    expect(result.current.nodes).toHaveLength(3);
    const bearNode = result.current.nodes.find((n: { id: string }) => n.id === "bear-turn-1");
    expect(bearNode).toBeDefined();
    expect(bearNode!.type).toBe("agentAnalysis");
    expect(bearNode!.data.label).toBe("Bear Counter #1");
  });

  test("[1-7-UNIT-006] @p1 creates risk check node with pending status", () => {
    const riskPayload: ReasoningNodePayload = {
      debateId: "debate-1",
      nodeId: "risk-check-1",
      nodeType: "risk_check",
      label: "Risk Assessment",
      summary: "Pending",
      agent: null,
      parentId: "bear-turn-1",
      isWinning: false,
      turn: null,
    };

    const { result } = renderHook(() =>
      useReasoningGraph([dataInputPayload, bullPayload, bearPayload, riskPayload])
    );

    const riskNode = result.current.nodes.find((n: { id: string }) => n.id === "risk-check-1");
    expect(riskNode).toBeDefined();
    expect(riskNode!.type).toBe("riskCheck");
  });

  test("[1-7-UNIT-007] @p1 handles empty payload array", () => {
    const { result } = renderHook(() => useReasoningGraph([]));

    expect(result.current.nodes).toHaveLength(0);
    expect(result.current.edges).toHaveLength(0);
  });
});
