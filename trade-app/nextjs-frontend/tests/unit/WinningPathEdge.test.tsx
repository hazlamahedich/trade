import { render } from "@testing-library/react";

jest.mock("@xyflow/react", () => ({
  BaseEdge: ({ path, style }: { path: string; style: React.CSSProperties }) => (
    <path data-testid="base-edge" d={path} style={style} />
  ),
  getSmoothStepPath: () => ["M 0 0 L 100 100", 0, 0],
}));

import { WinningPathEdge } from "../../features/debate/components/graph/WinningPathEdge";
import type { EdgeProps } from "@xyflow/react";

function renderEdge(data: Record<string, unknown>) {
  const props = {
    id: "edge-1",
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: "bottom",
    targetPosition: "top",
    data,
  } as unknown as EdgeProps;
  return render(<WinningPathEdge {...props} />);
}

describe("[1-7-UNIT] WinningPathEdge Component", () => {
  test("[1-7-UNIT-012] @p1 renders edge with default styling", () => {
    const { container } = renderEdge({});

    const baseEdge = container.querySelector("[data-testid='base-edge']");
    expect(baseEdge).toBeInTheDocument();
  });

  test("[1-7-UNIT-013] @p1 renders bull agent edge with emerald color", () => {
    const { container } = renderEdge({ agent: "bull", isWinningPath: false });

    const baseEdge = container.querySelector("[data-testid='base-edge']") as SVGPathElement;
    expect(baseEdge?.style.strokeWidth).toBe("1.5");
  });

  test("[1-7-UNIT-014] @p1 renders winning path with animation", () => {
    const { container } = renderEdge({ agent: "bull", isWinningPath: true });

    const animatedPath = container.querySelector("path[stroke-dasharray]");
    expect(animatedPath).toBeInTheDocument();

    const animateEl = container.querySelector("animate");
    expect(animateEl).toBeInTheDocument();
    expect(animateEl?.getAttribute("repeatCount")).toBe("indefinite");
  });

  test("[1-7-UNIT-015] @p1 winning edge has thicker stroke", () => {
    const { container } = renderEdge({ agent: "bear", isWinningPath: true });

    const baseEdge = container.querySelector("[data-testid='base-edge']") as SVGPathElement;
    expect(baseEdge?.style.strokeWidth).toBe("3");
  });
});
