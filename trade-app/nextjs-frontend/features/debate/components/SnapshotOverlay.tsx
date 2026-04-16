import type { RefObject } from "react";
import type { SnapshotInput } from "../types/snapshot";
import { SnapshotTemplate } from "./SnapshotTemplate";

interface SnapshotOverlayProps extends SnapshotInput {
  overlayRef: RefObject<HTMLDivElement | null>;
}

export function SnapshotOverlay({
  overlayRef,
  ...snapshotProps
}: SnapshotOverlayProps) {
  return (
    <div
      ref={overlayRef}
      data-testid="snapshot-overlay"
      aria-hidden="true"
      role="presentation"
      style={{
        position: "fixed",
        left: -9999,
        top: 0,
        visibility: "visible",
        display: "block",
        width: 600,
        overflow: "hidden",
      }}
    >
      <SnapshotTemplate {...snapshotProps} />
    </div>
  );
}
