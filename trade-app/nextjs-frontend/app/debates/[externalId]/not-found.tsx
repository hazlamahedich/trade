import Link from "next/link";

export default function DebateNotFound() {
  return (
    <main className="min-h-screen bg-background text-slate-100 flex items-center justify-center">
      <div className="text-center px-4">
        <h1 className="text-4xl font-bold mb-4">Debate Not Found</h1>
        <p className="text-slate-400 mb-8">
          The debate you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Link
          href="/dashboard/debates"
          className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 min-h-[44px]"
        >
          View Debate History
        </Link>
      </div>
    </main>
  );
}
