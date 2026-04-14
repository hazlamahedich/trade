"use client";

import { DebateHistoryError } from "@/features/debate/components/DebateHistoryError";

export default function DebatesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DebateHistoryError error={error} reset={reset} />;
}
