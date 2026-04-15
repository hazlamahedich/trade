import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-1/3 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl animate-fade-in" />
        <div className="absolute right-1/4 top-1/2 h-64 w-64 rounded-full bg-rose-500/10 blur-3xl animate-fade-in animation-delay-200" />
      </div>

      <div className="relative z-10 max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Watch AI Agents Debate Your Next Trade
        </h1>

        <p className="mt-6 text-lg text-slate-300 sm:text-xl">
          Two AI agents argue both sides of every trade. You listen, weigh the
          evidence, and decide. No more analysis paralysis.
        </p>

        <p className="mt-3 text-sm font-medium text-slate-400">
          It&apos;s called Cognitive Offloading — and it works.
        </p>

        <div className="mt-8 flex items-center justify-center gap-6">
          <svg width="56" height="56" viewBox="0 0 56 56" className="text-emerald-500" aria-hidden="true">
            <circle cx="28" cy="28" r="26" fill="currentColor" opacity="0.1" />
            <path d="M18 14l-4-6M38 14l4-6M22 20c-2 0-4 1-5 3M34 20c2 0 4 1 5 3M20 30c0 4 4 10 8 10s8-6 8-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M24 30a1.5 1.5 0 01-3 0M32 30a1.5 1.5 0 01-3 0" fill="currentColor" />
            <path d="M14 42l6-8M42 42l-6-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </svg>
          <span className="text-slate-400 text-sm font-bold tracking-widest">VS</span>
          <svg width="56" height="56" viewBox="0 0 56 56" className="text-rose-500" aria-hidden="true">
            <circle cx="28" cy="28" r="26" fill="currentColor" opacity="0.1" />
            <path d="M14 18l6 4M42 18l-6 4M14 22l6 2M42 22l-6 2M20 34c0-4 4-10 8-10s8 6 8 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M24 32a1.5 1.5 0 01-3 0M32 32a1.5 1.5 0 01-3 0" fill="currentColor" />
            <path d="M22 40c2 2 4 3 6 3s4-1 6-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>
        </div>

        <div className="mt-10">
          <Link
            href="/debates"
            className="inline-flex items-center justify-center rounded-sm bg-emerald-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 min-h-[44px] min-w-[44px]"
          >
            See it in action
          </Link>
        </div>
      </div>
    </section>
  );
}
