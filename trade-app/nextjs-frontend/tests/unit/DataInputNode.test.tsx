import { render, screen } from "@testing-library/react";
import type { NodeProps } from "@xyflow/react";

jest.mock("@xyflow/react", () => ({
  Handle: ({ type, position: _position }: { type: string; position: string }) => (
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

import { DataInputNode } from "../../features/debate/components/graph/DataInputNode";

function renderNode(data: Record<string, unknown>) {
  const props = { data, id: "test-node" } as unknown as NodeProps;
  return render(<DataInputNode {...props} />);
}

describe("[1-7-UNIT] DataInputNode Component", () => {
  test("[1-7-UNIT-008] @p1 renders data input node with label and summary", () => {
    renderNode({
      label: "BTC Market Data",
      summary: "Price: $50,000",
      asset: "BTC",
      isWinning: false,
    });

    expect(screen.getByText("BTC Market Data")).toBeInTheDocument();
    expect(screen.getByText("Price: $50,000")).toBeInTheDocument();
  });

  test("[1-7-UNIT-009] @p1 applies winning ring class when isWinning is true", () => {
    const { container } = renderNode({
      label: "BTC Market Data",
      summary: "Test",
      asset: "BTC",
      isWinning: true,
    });

    const nodeEl = container.firstChild as HTMLElement;
    expect(nodeEl.className).toContain("ring-2");
    expect(nodeEl.className).toContain("ring-slate-400");
  });

  test("[1-7-UNIT-010] @p1 has accessible aria-label", () => {
    renderNode({
      label: "BTC Market Data",
      summary: "Test",
      asset: "BTC",
      isWinning: false,
    });

    expect(screen.getByRole("group", { name: /Data Input: BTC Market Data/i })).toBeInTheDocument();
  });
});
