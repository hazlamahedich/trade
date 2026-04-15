export function ValuePropSection() {
  return (
    <section className="px-6 py-16" aria-labelledby="value-prop-heading">
      <div className="mx-auto max-w-3xl text-center">
        <h2
          id="value-prop-heading"
          className="text-3xl font-bold text-white"
        >
          Stop Second-Guessing. Watch the Debate.
        </h2>
        <p className="mt-4 text-lg text-slate-300">
          Bull makes the case. Bear tears it apart. Guardian flags the risks.
          You get clarity.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-6">
          <div className="flex items-center gap-2 rounded-lg bg-slate-800 border border-white/15 px-4 py-3">
            <span className="text-sm font-medium text-slate-400">Raw Data</span>
          </div>
          <svg width="24" height="24" viewBox="0 0 24 24" className="text-slate-500 rotate-90 sm:rotate-0" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex items-center gap-2 rounded-lg bg-slate-800 border border-white/15 px-4 py-3">
            <span className="text-sm font-medium text-emerald-400">Bull</span>
            <span className="text-sm text-slate-400">&</span>
            <span className="text-sm font-medium text-rose-400">Bear</span>
            <span className="text-sm font-medium text-slate-300">Argue</span>
          </div>
          <svg width="24" height="24" viewBox="0 0 24 24" className="text-slate-500 rotate-90 sm:rotate-0" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex items-center gap-2 rounded-lg bg-slate-800 border border-white/15 px-4 py-3">
            <span className="text-sm font-medium text-white">You Get Clarity</span>
          </div>
        </div>
      </div>
    </section>
  );
}
