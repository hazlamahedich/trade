"use client";

import { SnapshotButton } from "./SnapshotButton";
import { ShareDebateButton } from "./ShareDebateButton";

interface DebateToolbarProps {
  showSnapshot: boolean;
  onGenerateSnapshot: () => Promise<void>;
  snapshotState: import("../types/snapshot").SnapshotState;
  onResetSnapshotState: () => void;
  snapshotSuccessAnnouncement?: string;
  assetName: string;
  externalId: string;
  hasExternalId: boolean;
}

export function DebateToolbar({
  showSnapshot,
  onGenerateSnapshot,
  snapshotState,
  onResetSnapshotState,
  snapshotSuccessAnnouncement,
  assetName,
  externalId,
  hasExternalId,
}: DebateToolbarProps) {
  if (!showSnapshot) return null;

  return (
    <div className="absolute top-2 right-2 z-10 flex gap-2">
      <SnapshotButton
        onClick={onGenerateSnapshot}
        state={snapshotState}
        onResetState={onResetSnapshotState}
        successAnnouncement={snapshotSuccessAnnouncement}
      />
      <ShareDebateButton
        assetName={assetName}
        externalId={externalId}
        disabled={!hasExternalId}
        source="debate_stream"
      />
    </div>
  );
}
