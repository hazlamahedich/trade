"use client";

import { useEffect } from "react";

export default function DebateDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DebateDetailError]", error.message, {
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <main className="min-h-screen bg-background text-slate-100 flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
        <p className="text-slate-400 mb-8">
          Failed to load this debate. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 min-h-[44px]"
        >
          Try Again
        </button>
      </div>
    </main>
  );
}
