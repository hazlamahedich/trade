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
          <svg width="48" height="48" viewBox="0 0 48 48" className="text-emerald-500" aria-hidden="true">
            <circle cx="24" cy="24" r="20" fill="currentColor" opacity="0.15" />
            <path d="M16 20h16M16 28h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="text-slate-400 text-sm font-medium">vs</span>
          <svg width="48" height="48" viewBox="0 0 48 48" className="text-rose-500" aria-hidden="true">
            <circle cx="24" cy="24" r="20" fill="currentColor" opacity="0.15" />
            <path d="M16 20h16M22 28h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
