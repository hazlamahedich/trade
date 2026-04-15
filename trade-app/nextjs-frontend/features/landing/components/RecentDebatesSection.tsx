import Link from "next/link";
import { DebatePreviewCard } from "./DebatePreviewCard";
import type { RecentDebatePreview } from "../types";

interface RecentDebatesSectionProps {
  debates: RecentDebatePreview[];
}

export function RecentDebatesSection({ debates }: RecentDebatesSectionProps) {
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

      {debates.length === 0 ? (
        <div className="mx-auto mt-10 max-w-md text-center">
          <p className="text-sm text-slate-400">
            Debates appear here as they happen.{" "}
            <Link
              href="/debates"
              className="text-emerald-400 underline hover:text-emerald-300 transition-colors"
            >
              Start the first one
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {debates.map((debate) => (
            <DebatePreviewCard key={debate.externalId} debate={debate} />
          ))}
        </div>
      )}
    </section>
  );
}
