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

describe("[1-7-UNIT] useReasoningGraph Edge Cases", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("[1-7-UNIT-020] @p1 throws on unknown node type", () => {
    const unknownPayload = {
      debateId: "debate-1",
      nodeId: "unknown-1",
      nodeType: "unknown_type" as ReasoningNodePayload["nodeType"],
      label: "Unknown",
      summary: "Bad type",
      agent: null,
      parentId: null,
      isWinning: false,
      turn: null,
    };

    expect(() => {
      renderHook(() => useReasoningGraph([unknownPayload]));
    }).toThrow("Unknown node type: unknown_type");
  });

  test("[1-7-UNIT-021] @p2 handles multiple turns building correct chain", () => {
    const payloads: ReasoningNodePayload[] = [
      {
        debateId: "debate-1",
        nodeId: "data-CHAIN",
        nodeType: "data_input",
        label: "BTC Market Data",
        summary: "Loaded",
        agent: null,
        parentId: null,
        isWinning: false,
        turn: null,
      },
      {
        debateId: "debate-1",
        nodeId: "bull-turn-1",
        nodeType: "bull_analysis",
        label: "Bull Arg #1",
        summary: "Bullish",
        agent: "bull",
        parentId: "data-CHAIN",
        isWinning: false,
        turn: 1,
      },
      {
        debateId: "debate-1",
        nodeId: "bear-turn-1",
        nodeType: "bear_counter",
        label: "Bear Counter #1",
        summary: "Bearish",
        agent: "bear",
        parentId: "bull-turn-1",
        isWinning: false,
        turn: 1,
      },
      {
        debateId: "debate-1",
        nodeId: "bull-turn-2",
        nodeType: "bull_analysis",
        label: "Bull Arg #2",
        summary: "Still bullish",
        agent: "bull",
        parentId: "bear-turn-1",
        isWinning: false,
        turn: 2,
      },
    ];

    const { result } = renderHook(() => useReasoningGraph(payloads));

    expect(result.current.nodes).toHaveLength(4);
    expect(result.current.edges).toHaveLength(3);

    expect(result.current.edges[0].source).toBe("data-CHAIN");
    expect(result.current.edges[0].target).toBe("bull-turn-1");
    expect(result.current.edges[1].source).toBe("bull-turn-1");
    expect(result.current.edges[1].target).toBe("bear-turn-1");
    expect(result.current.edges[2].source).toBe("bear-turn-1");
    expect(result.current.edges[2].target).toBe("bull-turn-2");
  });

  test("[1-7-UNIT-022] @p2 handles winning path update for risk_check node type", () => {
    const payloads: ReasoningNodePayload[] = [
      {
        debateId: "debate-1",
        nodeId: "data-WINRISK",
        nodeType: "data_input",
        label: "ETH Market Data",
        summary: "Loaded",
        agent: null,
        parentId: null,
        isWinning: false,
        turn: null,
      },
      {
        debateId: "debate-1",
        nodeId: "risk-check-win",
        nodeType: "risk_check",
        label: "Risk Assessment",
        summary: "Pending",
        agent: null,
        parentId: "data-WINRISK",
        isWinning: false,
        turn: null,
      },
      {
        debateId: "debate-1",
        nodeId: "risk-check-win",
        nodeType: "risk_check",
        label: "Risk Assessment",
        summary: "All clear",
        agent: null,
        parentId: "data-WINRISK",
        isWinning: true,
        turn: null,
      },
    ];

    const { result } = renderHook(() => useReasoningGraph(payloads));

    const riskNode = result.current.nodes.find(
      (n: { id: string }) => n.id === "risk-check-win"
    );
    expect(riskNode).toBeDefined();
    expect(riskNode!.data.isWinning).toBe(true);

    const edge = result.current.edges.find(
      (e: { source: string; target: string }) =>
        e.source === "data-WINRISK" && e.target === "risk-check-win"
    );
    expect(edge).toBeDefined();
    expect(edge!.data!.isWinningPath).toBe(true);
  });
});
