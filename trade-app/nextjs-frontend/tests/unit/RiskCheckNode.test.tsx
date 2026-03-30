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

jest.mock("lucide-react", () => ({
  Shield: ({ className }: { className?: string }) => (
    <svg data-testid="shield-icon" className={className} />
  ),
}));

import { RiskCheckNode } from "../../features/debate/components/graph/RiskCheckNode";

function renderRiskCheckNode(data: Record<string, unknown>) {
  const props = { data, id: "test-risk-node" } as unknown as NodeProps;
  return render(<RiskCheckNode {...props} />);
}

describe("[1-7-UNIT] RiskCheckNode Component", () => {
  test("[1-7-UNIT-016] @p1 renders risk check node with pending status showing Awaiting Guardian", () => {
    renderRiskCheckNode({
      label: "Risk Assessment",
      summary: "Pending",
      status: "pending",
      isWinning: false,
    });

    expect(screen.getByText("Risk Assessment")).toBeInTheDocument();
    expect(screen.getByText("Awaiting Guardian...")).toBeInTheDocument();
  });

  test("[1-7-UNIT-017] @p1 renders risk check node with safe status showing summary text", () => {
    renderRiskCheckNode({
      label: "Risk Assessment",
      summary: "No significant risks detected",
      status: "safe",
      isWinning: false,
    });

    expect(screen.getByText("Risk Assessment")).toBeInTheDocument();
    expect(screen.getByText("No significant risks detected")).toBeInTheDocument();
  });

  test("[1-7-UNIT-018] @p1 applies winning ring class when isWinning is true", () => {
    const { container } = renderRiskCheckNode({
      label: "Risk Assessment",
      summary: "Approved",
      status: "safe",
      isWinning: true,
    });

    const nodeEl = container.firstChild as HTMLElement;
    expect(nodeEl.className).toContain("ring-2");
    expect(nodeEl.className).toContain("ring-violet-500");
  });

  test("[1-7-UNIT-019] @p1 has accessible aria-label including status", () => {
    renderRiskCheckNode({
      label: "Risk Assessment",
      summary: "Pending",
      status: "pending",
      isWinning: false,
    });

    expect(
      screen.getByRole("group", { name: /Risk Check: Risk Assessment \(pending\)/i })
    ).toBeInTheDocument();
  });
});
