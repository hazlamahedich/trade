"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

interface FilterChip {
  key: string;
  label: string;
  value: string;
}

interface DebateHistoryFilterChipsProps {
  asset?: string;
  outcome?: string;
}

function getOutcomeLabel(outcome: string): string {
  switch (outcome) {
    case "bull":
      return "Bull Wins";
    case "bear":
      return "Bear Wins";
    case "undecided":
      return "Undecided";
    default:
      return outcome;
  }
}

export function DebateHistoryFilterChips({
  asset,
  outcome,
}: DebateHistoryFilterChipsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const chips: FilterChip[] = [];
  if (asset) chips.push({ key: "asset", label: "Asset", value: asset.toUpperCase() });
  if (outcome)
    chips.push({
      key: "outcome",
      label: "Outcome",
      value: getOutcomeLabel(outcome),
    });

  if (chips.length === 0) return null;

  function removeFilter(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    params.set("page", "1");
    router.push(`/dashboard/debates?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2" role="list" aria-label="Active filters">
      {chips.map((chip) => (
        <button
          key={chip.key}
          role="listitem"
          onClick={() => removeFilter(chip.key)}
          className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-sm text-slate-300 hover:bg-white/15 transition-colors min-h-[44px]"
          aria-label={`Remove ${chip.label} filter`}
          type="button"
        >
          <span>
            {chip.label}: {chip.value}
          </span>
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
