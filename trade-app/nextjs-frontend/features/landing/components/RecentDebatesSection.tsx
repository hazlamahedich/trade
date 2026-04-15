import { DebatePreviewCard } from "./DebatePreviewCard";
import type { RecentDebatePreview } from "../types";

interface RecentDebatesSectionProps {
  debates: RecentDebatePreview[];
}

export function RecentDebatesSection({ debates }: RecentDebatesSectionProps) {
  if (debates.length === 0) {
    return null;
  }

  return (
    <section className="px-6 py-16" aria-labelledby="recent-debates-heading">
      <h2
        id="recent-debates-heading"
        className="text-center text-3xl font-bold text-white"
      >
        Recent Debates
      </h2>
      <p className="mt-3 text-center text-slate-400">
        Proof it&apos;s real — actual completed debates
      </p>

      <div className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {debates.map((debate) => (
          <DebatePreviewCard key={debate.externalId} debate={debate} />
        ))}
      </div>
    </section>
  );
}
