"use client";

import { useTransition, useState } from "react";
import { startDebate } from "@/features/debate/actions/start-debate-action";

const ASSET_OPTIONS = [
  { value: "btc", label: "Bitcoin (BTC)" },
  { value: "eth", label: "Ethereum (ETH)" },
  { value: "sol", label: "Solana (SOL)" },
] as const;

export function StartDebateForm({ compact = false }: { compact?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await startDebate(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start debate");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {ASSET_OPTIONS.map((asset) => (
          <button
            key={asset.value}
            type="submit"
            name="asset"
            value={asset.value}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-sm bg-slate-800 border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 hover:border-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px]"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Debating...
              </span>
            ) : (
              asset.label
            )}
          </button>
        ))}
      </div>
      {error && (
        <p className="text-sm text-rose-400" role="alert">
          {error}
        </p>
      )}
      {!compact && (
        <p className="text-xs text-slate-400">
          Select an asset to start an AI debate
        </p>
      )}
    </form>
  );
}
