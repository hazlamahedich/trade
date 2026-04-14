import { Skeleton } from "@/components/ui/skeleton";

export function DebateHistorySkeleton() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Loading debates"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          data-testid="skeleton-card"
          className="rounded-lg border border-white/15 bg-white/5 p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-6 w-16 bg-white/10" />
            <Skeleton className="h-6 w-20 rounded-full bg-white/10" />
          </div>
          <Skeleton className="h-2 w-full rounded-full bg-white/10 mb-1" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-12 bg-white/10" />
            <Skeleton className="h-3 w-12 bg-white/10" />
          </div>
          <div className="flex items-center justify-between mt-3">
            <Skeleton className="h-4 w-16 bg-white/10" />
            <Skeleton className="h-4 w-16 bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
