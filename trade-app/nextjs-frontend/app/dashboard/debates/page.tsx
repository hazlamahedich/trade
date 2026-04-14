import { Suspense } from "react";
import { DebateHistorySkeleton } from "@/features/debate/components/DebateHistorySkeleton";
import { DebateHistoryList } from "@/features/debate/components/DebateHistoryList";

interface DebatesPageProps {
  searchParams: Promise<{
    page?: string;
    size?: string;
    asset?: string;
    outcome?: string;
  }>;
}

export default async function DebatesPage({ searchParams }: DebatesPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const size = Math.max(1, Number(params.size) || 20);
  const asset = (params.asset ?? "").toLowerCase();
  const outcome = params.outcome ?? "";

  const paramsKey = `asset=${asset}&outcome=${outcome}&page=${page}&size=${size}`;

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6 text-slate-100">
        Debate History
      </h2>

      <Suspense key={paramsKey} fallback={<DebateHistorySkeleton />}>
        <DebateHistoryList
          page={page}
          size={size}
          asset={asset}
          outcome={outcome}
        />
      </Suspense>
    </div>
  );
}

export const dynamic = "force-dynamic";
