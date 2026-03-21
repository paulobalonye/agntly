'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TICKER = {
  tasks: '—',
  vol: '—',
  fee: '—',
} as const;

const NAV_LINKS = [
  { label: 'registry', href: '/marketplace' },
  { label: 'my_agents', href: '/my-agents' },
  { label: 'wallet', href: '/wallet' },
  { label: 'docs', href: '/docs' },
  { label: 'analytics', href: '/analytics' },
] as const;

export function MarketplaceNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-[100] flex items-center gap-8 px-8 h-[52px] border-b border-border bg-bg-0/[0.92] backdrop-blur-[12px]">
      {/* Logo */}
      <div className="font-mono text-[15px] font-medium text-accent tracking-[-0.02em] flex items-center gap-2 flex-shrink-0">
        <span className="w-[7px] h-[7px] bg-accent rounded-full animate-pulse-dot" />
        AGNTLY.IO
      </div>

      {/* Nav links */}
      <ul className="flex gap-6 list-none flex-1">
        {NAV_LINKS.map(({ label, href }) => {
          const isActive = pathname === href;
          return (
            <li key={label}>
              <Link
                href={href}
                className={`font-mono text-[13px] tracking-[0.02em] transition-colors hover:text-t-0 ${
                  isActive ? 'text-accent' : 'text-t-1'
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Right: tickers + buttons */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Ticker strip — static values consistent with StatsBar */}
        <div className="flex gap-4 font-mono text-[11px]">
          <div className="flex gap-[5px] items-center">
            <span className="text-t-2">TASKS/24H</span>
            <span className="text-t-0">{TICKER.tasks}</span>
          </div>
          <div className="flex gap-[5px] items-center">
            <span className="text-t-2">VOL</span>
            <span className="text-t-0">{TICKER.vol}</span>
          </div>
          <div className="flex gap-[5px] items-center">
            <span className="text-t-2">AVG FEE</span>
            <span className="text-accent">{TICKER.fee}</span>
          </div>
        </div>

        <Link
          href="/wallet"
          className="bg-transparent border border-border-2 text-t-1 font-mono text-[11px] px-[14px] py-[6px] tracking-[0.04em] hover:border-accent hover:text-accent transition-all"
        >
          fund wallet
        </Link>
      </div>
    </nav>
  );
}
