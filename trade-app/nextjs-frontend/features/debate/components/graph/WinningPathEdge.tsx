"use client";

import { memo } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

function WinningPathEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const edgeData = data as { isWinningPath?: boolean; agent?: "bull" | "bear" } | undefined;
  const isWinning = edgeData?.isWinningPath ?? false;
  const agent = edgeData?.agent;

  const strokeColor = agent === "bull"
    ? "#10b981"
    : agent === "bear"
      ? "#f43f5e"
      : "#64748b";

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: isWinning ? 3 : 1.5,
          opacity: isWinning ? 1 : 0.6,
        }}
      />
      {isWinning && (
        <path
          d={edgePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={3}
          strokeDasharray="5 5"
          opacity={0.8}
        >
          <animate
            attributeName="stroke-dashoffset"
            values="10;0"
            dur="0.5s"
            repeatCount="indefinite"
          />
        </path>
      )}
    </>
  );
}

export const WinningPathEdge = memo(WinningPathEdgeComponent);
