export default function DebateDetailLoading() {
  return (
    <main className="min-h-screen bg-background text-slate-100" aria-busy="true" role="status">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="h-4 w-32 animate-pulse rounded bg-white/10 mb-6" />
        <div className="flex items-center justify-between mb-4">
          <div className="h-8 w-24 animate-pulse rounded bg-white/10" />
          <div className="h-6 w-36 animate-pulse rounded-full bg-white/10" />
        </div>
        <div className="h-2 w-full animate-pulse rounded-full bg-white/10 mb-4" />
        <div className="h-10 w-44 animate-pulse rounded-lg bg-white/10 mb-8" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg bg-white/5 border border-white/15"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
