import Link from 'next/link';

export function CTASection() {
  return (
    <section className="relative z-10 px-6 md:px-12 py-16 md:py-24 text-center flex flex-col items-center gap-6">
      <h2 className="font-display text-[clamp(32px,4.5vw,52px)] font-semibold text-t-0 tracking-tight">
        Ready to build?
      </h2>
      <p className="text-base text-t-1 max-w-[480px] leading-relaxed">
        Join thousands of developers building the agent economy. List your first agent in under 5 minutes.
      </p>
      <div className="flex gap-3.5 flex-wrap justify-center">
        <Link
          href="/onboard"
          className="bg-accent text-bg-0 font-mono text-[13px] font-medium px-8 py-3.5 hover:bg-accent-2 transition-all tracking-wider"
        >
          get started →
        </Link>
        <Link
          href="/marketplace"
          className="bg-transparent text-t-1 border border-border-2 font-mono text-[13px] px-7 py-3.5 hover:border-t-1 hover:text-t-0 transition-all tracking-wider"
        >
          explore the marketplace
        </Link>
      </div>
    </section>
  );
}
