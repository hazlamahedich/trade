interface VotePreviewBarProps {
  bullPct: number;
  bearPct: number;
  undecidedPct?: number;
}

export function VotePreviewBar({ bullPct, bearPct, undecidedPct = 0 }: VotePreviewBarProps) {
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-700" data-testid="vote-preview-bar">
      <div
        className="bg-emerald-500 transition-all"
        style={{ width: `${bullPct}%` }}
      />
      <div
        className="bg-rose-500 transition-all"
        style={{ width: `${bearPct}%` }}
      />
      {undecidedPct > 0 && (
        <div
          className="bg-slate-500 transition-all"
          style={{ width: `${undecidedPct}%` }}
        />
      )}
    </div>
  );
}
