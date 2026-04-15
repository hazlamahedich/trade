export function HowItWorksSection() {
  return (
    <section className="px-6 py-16" aria-labelledby="how-it-works-heading">
      <h2
        id="how-it-works-heading"
        className="text-center text-3xl font-bold text-white"
      >
        How It Works
      </h2>
      <p className="mt-3 text-center text-slate-400">
        Three steps to better trade decisions
      </p>

      <div className="mx-auto mt-12 grid max-w-4xl gap-8 sm:grid-cols-3">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <svg width="28" height="28" viewBox="0 0 28 28" className="text-emerald-500" aria-hidden="true">
              <path d="M8 10h12M8 14h8M8 18h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <p className="mt-4 text-lg font-semibold text-white">
            Bull Argues
          </p>
          <p className="mt-2 text-sm text-slate-400">
            The Bull agent makes the case for why this trade makes sense right now.
          </p>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20">
            <svg width="28" height="28" viewBox="0 0 28 28" className="text-rose-500" aria-hidden="true">
              <path d="M8 10l12 8M8 18l12-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <p className="mt-4 text-lg font-semibold text-white">
            Bear Counters
          </p>
          <p className="mt-2 text-sm text-slate-400">
            The Bear agent tears the argument apart, exposing risks and flaws.
          </p>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/10 border border-violet-500/20">
            <svg width="28" height="28" viewBox="0 0 28 28" className="text-violet-500" aria-hidden="true">
              <circle cx="14" cy="14" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M14 10v4l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <p className="mt-4 text-lg font-semibold text-white">
            You Decide
          </p>
          <p className="mt-2 text-sm text-slate-400">
            You listen, weigh the evidence, and make your own informed decision.
          </p>
        </div>
      </div>
    </section>
  );
}
