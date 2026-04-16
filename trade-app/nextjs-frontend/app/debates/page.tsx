import { Suspense } from "react";
import Link from "next/link";
import { DebateHistorySkeleton } from "@/features/debate/components/DebateHistorySkeleton";
import { DebateHistoryList } from "@/features/debate/components/DebateHistoryList";
import type { OutcomeFilter } from "@/features/debate/types/debate-history";

interface PublicDebatesPageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    asset?: string;
    outcome?: string;
  }>;
}

export default async function PublicDebatesPage({ searchParams }: PublicDebatesPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const size = Math.max(1, Number(params.size) || 20);
  const asset = (params.asset ?? "").toLowerCase();
  const rawOutcome = (params.outcome ?? "").toLowerCase();
  const outcome = (rawOutcome === "bull" || rawOutcome === "bear" ? rawOutcome : "") as OutcomeFilter;

  const paramsKey = `asset=${asset}&outcome=${outcome}&page=${page}&size=${size}`;

  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="border-b border-glass px-6 py-4" role="navigation" aria-label="Breadcrumb">
        <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
          &larr; Back to Home
        </Link>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Debate Archive
        </h1>
        <p className="text-slate-400 mb-8">
          Browse past debates between Bull and Bear AI agents.
        </p>

        <Suspense key={paramsKey} fallback={<DebateHistorySkeleton />}>
          <DebateHistoryList
            page={page}
            size={size}
            asset={asset}
            outcome={outcome}
            basePath="/debates"
          />
        </Suspense>
      </main>
    </div>
  );
}

export const metadata = {
  title: "Debate Archive | AI Trading Debate Lab",
  description: "Browse past debates between Bull and Bear AI agents on the AI Trading Debate Lab.",
};

export const revalidate = 30;
