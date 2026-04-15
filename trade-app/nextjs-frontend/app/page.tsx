import type { Metadata } from "next";
import Link from "next/link";
import { getLandingPageData } from "@/features/landing/actions/landing-data-action";
import { HeroSection } from "@/features/landing/components/HeroSection";
import { LiveNowTicker } from "@/features/landing/components/LiveNowTicker";
import { HowItWorksSection } from "@/features/landing/components/HowItWorksSection";
import { ValuePropSection } from "@/features/landing/components/ValuePropSection";
import { RecentDebatesSection } from "@/features/landing/components/RecentDebatesSection";
import { DisclaimerBanner } from "@/features/landing/components/DisclaimerBanner";
import { LandingFooter } from "@/features/landing/components/LandingFooter";
import { StickyCtaBar } from "@/features/landing/components/StickyCtaBar";

export const revalidate = 30;

export function generateMetadata(): Metadata {
  const title = "AI Trading Debate Arena — Watch Bulls & Bears Argue Your Next Trade";
  const description =
    "Two AI agents debate both sides of every trade in real time. Watch the arguments, weigh the evidence, and make smarter decisions.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: "https://ai-trading-debate.lab",
      siteName: "AI Trading Debate Lab",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function Home() {
  let data;
  try {
    data = await getLandingPageData();
  } catch {
    data = { activeDebate: null, recentDebates: [] };
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-emerald-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <div className="min-h-screen bg-slate-900">
        <div data-hero-section>
          <HeroSection />
          <LiveNowTicker activeDebate={data.activeDebate} />
        </div>

        <main id="main-content">
          <HowItWorksSection />
          <ValuePropSection />
          <RecentDebatesSection debates={data.recentDebates} />

          <section className="px-6 py-12 text-center" aria-labelledby="cta-heading">
            <h2 id="cta-heading" className="text-3xl font-bold text-white">
              Ready to Watch?
            </h2>
            <p className="mt-3 text-slate-400">
              Enter the arena and see AI agents debate in real time.
            </p>
            <div className="mt-6">
              <Link
                href="/debates"
                className="inline-flex items-center justify-center rounded-sm bg-emerald-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 min-h-[44px] min-w-[44px]"
              >
                Enter the Arena
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              By entering, you acknowledge our{" "}
              <a href="/risk-disclosure" className="underline hover:text-slate-400">
                risk disclosure
              </a>
              .
            </p>
          </section>

          <DisclaimerBanner />
        </main>

        <LandingFooter />
      </div>
      <StickyCtaBar />
    </>
  );
}
