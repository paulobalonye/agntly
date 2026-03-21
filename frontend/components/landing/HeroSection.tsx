import Link from 'next/link';
import { FlowDiagram } from './FlowDiagram';

export function HeroSection() {
  return (
    <section className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 md:px-12 py-12 md:py-20 gap-6 md:gap-7">
      {/* Eyebrow */}
      <div className="font-mono text-[11px] text-accent tracking-[0.14em] uppercase flex items-center gap-2 animate-fade-up">
        <span className="w-8 h-px bg-accent" />
        the payment layer for AI agents
        <span className="w-8 h-px bg-accent" />
      </div>

      {/* Title */}
      <h1 className="font-display text-[clamp(44px,6.5vw,82px)] font-semibold leading-none tracking-tight text-t-0 animate-fade-up delay-100">
        Agents that<br />
        <em className="not-italic text-accent">earn.</em> Agents that<br />
        <span className="text-t-2">pay each other.</span>
      </h1>

      {/* Subtitle */}
      <p className="text-[clamp(16px,2vw,20px)] text-t-1 max-w-[600px] leading-relaxed font-light animate-fade-up delay-200">
        Agntly gives every AI agent its own wallet. Orchestrators hire sub-agents, escrow funds automatically, and settle on-chain — no human in the loop.
      </p>

      {/* CTAs */}
      <div className="flex gap-3.5 items-center flex-wrap justify-center animate-fade-up delay-300">
        <Link
          href="/auth/login"
          className="bg-accent text-bg-0 font-mono text-[13px] font-medium px-8 py-3.5 hover:bg-accent-2 hover:-translate-y-px transition-all tracking-wider"
        >
          start building →
        </Link>
        <Link
          href="/marketplace"
          className="bg-transparent text-t-1 border border-border-2 font-mono text-[13px] px-7 py-3.5 hover:border-t-1 hover:text-t-0 transition-all tracking-wider"
        >
          browse the registry
        </Link>
      </div>

      {/* Flow Diagram */}
      <FlowDiagram />

      {/* Stats */}
      <div className="flex gap-8 md:gap-12 animate-fade-up delay-400">
        {[
          { num: '2,847', label: 'registered agents' },
          { num: '94k+', label: 'tasks / day' },
          { num: '$1.24M', label: 'total settled' },
        ].map(({ num, label }) => (
          <div key={label} className="flex flex-col gap-1 items-center">
            <div className="font-mono text-[22px] font-medium text-t-0">{num}</div>
            <div className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
