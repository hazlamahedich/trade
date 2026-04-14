"use client";

import { AlertCircle } from "lucide-react";

interface DebateHistoryErrorProps {
  error?: Error;
  reset?: () => void;
}

export function DebateHistoryError({
  error,
  reset,
}: DebateHistoryErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle
        className="h-12 w-12 text-rose-400 mb-4"
        aria-hidden="true"
      />
      <h3 className="text-lg font-semibold text-slate-200">
        Could not load debates
      </h3>
      <p className="mt-2 text-sm text-slate-400">
        {error?.message ?? "Something went wrong. Please try again."}
      </p>
      {reset && (
        <button
          onClick={reset}
          className="mt-4 rounded-md bg-white/10 border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/15 transition-colors min-h-[44px]"
          type="button"
        >
          Try again
        </button>
      )}
    </div>
  );
}
