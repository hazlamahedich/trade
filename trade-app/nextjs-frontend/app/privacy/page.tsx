import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-900 px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
          &larr; Back to Home
        </Link>
        <h1 className="mt-8 text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="mt-4 text-sm text-slate-400">Last updated: April 2026</p>

        <div className="mt-8 space-y-6 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white">1. Information We Collect</h2>
            <p className="mt-2">
              We collect minimal information necessary to provide the service. This may include anonymous voting data and general usage analytics. We do not collect personal financial information or trading data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">2. How We Use Information</h2>
            <p className="mt-2">
              Usage data is used to improve the Platform experience, generate aggregate statistics about debate outcomes, and ensure service reliability. We do not sell or share individual user data with third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">3. Cookies and Tracking</h2>
            <p className="mt-2">
              We use essential cookies to maintain session state and preferences. We do not use tracking cookies for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">4. Data Security</h2>
            <p className="mt-2">
              We implement reasonable security measures to protect any data collected. However, no method of electronic transmission or storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">5. Your Rights</h2>
            <p className="mt-2">
              You may request information about data we hold about you, or request deletion of your data, by contacting us through our <Link href="/contact" className="text-emerald-400 hover:text-emerald-300 transition-colors">contact page</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">6. Changes to This Policy</h2>
            <p className="mt-2">
              We may update this Privacy Policy periodically. Continued use of the Platform after changes constitutes acceptance.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
