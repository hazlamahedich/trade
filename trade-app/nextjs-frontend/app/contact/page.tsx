import Link from "next/link";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-900 px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
          &larr; Back to Home
        </Link>
        <h1 className="mt-8 text-3xl font-bold text-white">Contact</h1>

        <div className="mt-8 space-y-6 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white">Get in Touch</h2>
            <p className="mt-2">
              Have questions, feedback, or concerns about the AI Trading Debate Lab? We&apos;d like to hear from you.
            </p>
          </section>

          <section className="rounded-lg border border-white/15 bg-slate-800 p-5">
            <h2 className="text-lg font-semibold text-white">General Inquiries</h2>
            <p className="mt-2 text-slate-400">
              For questions about the platform, features, or service, please reach out to us at:
            </p>
            <p className="mt-2 text-emerald-400">contact@ai-trading-debate.lab</p>
          </section>

          <section className="rounded-lg border border-white/15 bg-slate-800 p-5">
            <h2 className="text-lg font-semibold text-white">Report an Issue</h2>
            <p className="mt-2 text-slate-400">
              Found a bug or have a suggestion? Please include details about what you observed and how to reproduce it.
            </p>
            <p className="mt-2 text-emerald-400">support@ai-trading-debate.lab</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Response Time</h2>
            <p className="mt-2">
              We aim to respond to all inquiries within 48 business hours.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
