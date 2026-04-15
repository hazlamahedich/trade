export function LandingFooter() {
  return (
    <footer className="border-t border-white/15 bg-slate-950 px-6 py-8" role="contentinfo">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="text-center sm:text-left">
          <p className="text-sm font-semibold text-slate-300">
            AI Trading Debate Lab
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Decision-support through adversarial AI
          </p>
        </div>

        <nav aria-label="Footer navigation">
          <ul className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
            <li>
              <a href="/terms" className="hover:text-slate-300 transition-colors">
                Terms of Service
              </a>
            </li>
            <li>
              <a href="/privacy" className="hover:text-slate-300 transition-colors">
                Privacy Policy
              </a>
            </li>
            <li>
              <a href="/risk-disclosure" className="hover:text-slate-300 transition-colors">
                Risk Disclosure
              </a>
            </li>
            <li>
              <a href="/contact" className="hover:text-slate-300 transition-colors">
                Contact
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
