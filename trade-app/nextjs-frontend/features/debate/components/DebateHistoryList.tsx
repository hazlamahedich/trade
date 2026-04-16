import { getDebateHistory } from "@/features/debate/actions/debate-history-action";
import { DebateHistoryCard } from "@/features/debate/components/DebateHistoryCard";
import { DebateHistoryEmpty } from "@/features/debate/components/DebateHistoryEmpty";
import { DebateHistoryFilters } from "@/features/debate/components/DebateHistoryFilters";
import { DebateHistoryFilterChips } from "@/features/debate/components/DebateHistoryFilterChips";
import { PagePagination } from "@/components/page-pagination";
import { PageSizeSelector } from "@/components/page-size-selector";
import type { OutcomeFilter } from "@/features/debate/types/debate-history";

interface DebateHistoryListProps {
  page: number;
  size: number;
  asset: string;
  outcome: OutcomeFilter;
  basePath?: string;
}

export async function DebateHistoryList({
  page,
  size,
  asset,
  outcome,
  basePath = "/dashboard/debates",
}: DebateHistoryListProps) {
  const response = await getDebateHistory({
    page,
    size,
    asset: asset || undefined,
    outcome: outcome || undefined,
  });

  const hasActiveFilters = !!(asset || outcome);
  const isPageOutOfRange = response.meta.pages > 0 && page > response.meta.pages;
  const effectiveHasFilters = hasActiveFilters || isPageOutOfRange;
  const extraParams: Record<string, string> = {};
  if (asset) extraParams.asset = asset;
  if (outcome) extraParams.outcome = outcome;

  if (response.data.length === 0) {
    return <DebateHistoryEmpty hasActiveFilters={effectiveHasFilters} />;
  }

  return (
    <div>
      <div className="sticky top-0 z-10 bg-muted/40 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <DebateHistoryFilters initialAsset={asset} initialOutcome={outcome} />
          <PageSizeSelector
            currentSize={size}
            basePath={basePath}
            extraParams={extraParams}
          />
        </div>
        <div className="mt-3">
          <DebateHistoryFilterChips asset={asset} outcome={outcome} />
        </div>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4" role="list" aria-live="polite">
        {response.data.map((debate) => (
          <li key={debate.externalId}>
            <DebateHistoryCard debate={debate} />
          </li>
        ))}
      </ul>

      <PagePagination
        currentPage={response.meta.page}
        totalPages={response.meta.pages}
        pageSize={response.meta.size}
        totalItems={response.meta.total}
        basePath={basePath}
        extraParams={extraParams}
      />
    </div>
  );
}
