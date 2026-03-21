'use client';

import Link from 'next/link';

function getEnvironment(): { label: string; color: string } {
  if (typeof window === 'undefined') return { label: 'production', color: 'accent' };
  const host = window.location.hostname;
  if (host.startsWith('sandbox')) return { label: 'sandbox', color: 'amber' };
  if (host === 'localhost') return { label: 'local', color: 'blue' };
  return { label: 'production', color: 'accent' };
}

export function Footer() {
  const env = getEnvironment();

  return (
    <footer className="relative z-10 border-t border-border px-6 md:px-12 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex gap-6">
        {[
          { label: 'docs', href: '/docs' },
          { label: 'sdk', href: '/docs#sdk' },
          { label: 'status', href: '/admin/services' },
          { label: 'github', href: '#' },
          { label: 'discord', href: '#' },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="font-mono text-[11px] text-t-2 hover:text-t-1 transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-3 font-mono text-[11px] text-t-2">
        <div className={`flex items-center gap-1 bg-${env.color}/[0.07] border border-${env.color}/20 px-2 py-0.5 text-${env.color} text-[10px]`}>
          <span className={`w-[5px] h-[5px] rounded-full bg-${env.color} animate-pulse-dot`} />
          {env.label}
        </div>
        <div className="flex items-center gap-1 bg-accent/[0.07] border border-accent/20 px-2 py-0.5 text-accent text-[10px]">
          <span className="w-[5px] h-[5px] rounded-full bg-accent animate-pulse-dot" />
          Base L2 · USDC
        </div>
      </div>
    </footer>
  );
}
