"use client";

import { useRouter } from "next/navigation";
import { SearchX, Inbox } from "lucide-react";

interface DebateHistoryEmptyProps {
  hasActiveFilters: boolean;
}

export function DebateHistoryEmpty({
  hasActiveFilters,
}: DebateHistoryEmptyProps) {
  const router = useRouter();

  if (hasActiveFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <SearchX className="h-12 w-12 text-slate-400 mb-4" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-slate-200">
          No debates match your filters
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          Try adjusting or clearing your filters.
        </p>
        <button
          onClick={() => router.push("/dashboard/debates")}
          className="mt-4 rounded-md bg-white/10 border border-glass px-4 py-2 text-sm text-slate-300 hover:bg-white/15 transition-colors min-h-[44px]"
          type="button"
          aria-label="Clear all filters"
        >
          Clear all filters
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Inbox className="h-12 w-12 text-slate-400 mb-4" aria-hidden="true" />
      <h3 className="text-lg font-semibold text-slate-200">
        No debates yet
      </h3>
      <p className="mt-2 text-sm text-slate-400">
        Debates will appear here once they start.
      </p>
    </div>
  );
}
