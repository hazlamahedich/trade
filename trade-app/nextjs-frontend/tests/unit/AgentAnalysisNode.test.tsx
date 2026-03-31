import { render, screen } from "@testing-library/react";
import type { NodeProps } from "@xyflow/react";

jest.mock("@xyflow/react", () => ({
  Handle: ({ type }: { type: string; position: string }) => (
    <div data-handle={type} />
  ),
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
      <div {...props}>{children}</div>
    ),
  },
  useReducedMotion: () => false,
}));

jest.mock("../../features/debate/components/AgentAvatar", () => ({
  AgentAvatar: ({ agent }: { agent: string; size?: string }) => (
    <div data-testid={`${agent}-icon`}>{agent === "bull" ? "↑" : "↓"}</div>
  ),
}));

import { AgentAnalysisNode } from "../../features/debate/components/graph/AgentAnalysisNode";

function renderNode(data: Record<string, unknown>) {
  const props = { data, id: "test-node" } as unknown as NodeProps;
  return render(<AgentAnalysisNode {...props} />);
}

describe("[1-7-UNIT] AgentAnalysisNode Component", () => {
  test("[1-7-UNIT-009] @p1 renders bull analysis node with correct styling", () => {
    renderNode({
      label: "Bull Argument #1",
      summary: "Strong bullish case",
      agent: "bull",
      turn: 1,
      isWinning: false,
    });

    expect(screen.getByText("Bull Argument #1")).toBeInTheDocument();
    expect(screen.getByText("Strong bullish case")).toBeInTheDocument();
  });

  test("[1-7-UNIT-010] @p1 renders bear counter node with correct styling", () => {
    renderNode({
      label: "Bear Counter #1",
      summary: "Bearish counter",
      agent: "bear",
      turn: 1,
      isWinning: false,
    });

    expect(screen.getByText("Bear Counter #1")).toBeInTheDocument();
    expect(screen.getByText("Bearish counter")).toBeInTheDocument();
  });

  test("[1-7-UNIT-011] @p1 renders winning node with ring class", () => {
    const { container } = renderNode({
      label: "Bull Argument #1",
      summary: "Winning!",
      agent: "bull",
      turn: 1,
      isWinning: true,
    });

    expect(container.querySelector("[class*='ring-emerald-500']")).toBeInTheDocument();
  });
});
