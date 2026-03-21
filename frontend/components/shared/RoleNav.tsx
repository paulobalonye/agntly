'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface TickerData {
  tasks: string;
  vol: string;
  fee: string;
}

const BUILDER_LINKS = [
  { label: 'dashboard', href: '/dashboard' },
  { label: 'my_agents', href: '/my-agents' },
  { label: 'wallet', href: '/wallet' },
  { label: 'docs', href: '/docs' },
  { label: 'analytics', href: '/analytics' },
] as const;

const ORCHESTRATOR_LINKS = [
  { label: 'registry', href: '/marketplace' },
  { label: 'my_tasks', href: '/my-tasks' },
  { label: 'wallet', href: '/wallet' },
  { label: 'docs', href: '/docs' },
  { label: 'analytics', href: '/analytics' },
] as const;

const BOTH_LINKS = [
  { label: 'registry', href: '/marketplace' },
  { label: 'dashboard', href: '/dashboard' },
  { label: 'my_agents', href: '/my-agents' },
  { label: 'my_tasks', href: '/my-tasks' },
  { label: 'wallet', href: '/wallet' },
  { label: 'docs', href: '/docs' },
  { label: 'analytics', href: '/analytics' },
] as const;

const ADMIN_LINKS = [
  { label: 'admin', href: '/admin' },
  { label: 'registry', href: '/marketplace' },
  { label: 'dashboard', href: '/dashboard' },
  { label: 'wallet', href: '/wallet' },
  { label: 'docs', href: '/docs' },
] as const;

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp('(^| )' + escapedName + '=([^;]+)'));
  return match ? match[2] ?? null : null;
}

type Role = 'builder' | 'hire' | 'both' | 'admin' | null;

function getLinksForRole(role: Role): ReadonlyArray<{ label: string; href: string }> {
  if (role === 'admin') return ADMIN_LINKS;
  if (role === 'builder') return BUILDER_LINKS;
  if (role === 'both') return BOTH_LINKS;
  // Default: orchestrator view (no dashboard, no my_agents)
  return ORCHESTRATOR_LINKS;
}

export function RoleNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role>(null);
  const [mounted, setMounted] = useState(false);
  const [ticker, setTicker] = useState<TickerData>({ tasks: '—', vol: '—', fee: '—' });

  useEffect(() => {
    const cookieRole = getCookie('agntly_role') as Role;
    setRole(cookieRole);
    setMounted(true);

    // Fetch live platform stats
    fetch('/api/platform/stats')
      .then((r) => r.json())
      .then((json) => {
        if (json?.data) {
          const d = json.data;
          const tasks = Number(d.tasksToday ?? 0);
          const vol = parseFloat(d.totalVolume ?? '0');
          setTicker({
            tasks: tasks > 0 ? tasks.toLocaleString() : '0',
            vol: vol > 0 ? `$${vol >= 1000 ? (vol / 1000).toFixed(1) + 'k' : vol.toFixed(2)}` : '$0',
            fee: d.avgFee ? `$${d.avgFee}` : '$0',
          });
        }
      })
      .catch(() => {});
  }, []);

  // Use ORCHESTRATOR_LINKS until mounted to avoid hydration mismatch
  const links = mounted ? getLinksForRole(role) : ORCHESTRATOR_LINKS;
  const isBuilder = mounted && (role === 'builder' || role === 'both');

  return (
    <nav className="sticky top-0 z-[100] flex items-center gap-8 px-8 h-[52px] border-b border-border bg-bg-0/[0.92] backdrop-blur-[12px]">
      {/* Logo */}
      <div className="font-mono text-[15px] font-medium text-accent tracking-[-0.02em] flex items-center gap-2 flex-shrink-0">
        <span className="w-[7px] h-[7px] bg-accent rounded-full animate-pulse-dot" />
        AGNTLY.IO
      </div>

      {/* Nav links */}
      <ul className="flex gap-6 list-none flex-1">
        {links.map(({ label, href }) => {
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
        {/* Ticker strip */}
        <div className="flex gap-4 font-mono text-[11px]">
          <div className="flex gap-[5px] items-center">
            <span className="text-t-2">TASKS/24H</span>
            <span className="text-t-0">{ticker.tasks}</span>
          </div>
          <div className="flex gap-[5px] items-center">
            <span className="text-t-2">VOL</span>
            <span className="text-t-0">{ticker.vol}</span>
          </div>
          <div className="flex gap-[5px] items-center">
            <span className="text-t-2">AVG FEE</span>
            <span className="text-accent">{ticker.fee}</span>
          </div>
        </div>

        {isBuilder && (
          <Link
            href="/my-agents"
            className="bg-accent text-bg-0 font-mono text-[11px] font-medium px-[14px] py-[6px] tracking-[0.04em] hover:bg-accent-2 transition-all"
          >
            + list agent
          </Link>
        )}

        <Link
          href="/wallet"
          className="bg-transparent border border-border-2 text-t-1 font-mono text-[11px] px-[14px] py-[6px] tracking-[0.04em] hover:border-accent hover:text-accent transition-all"
        >
          fund wallet
        </Link>

        <button
          onClick={async () => {
            try {
              await fetch('/api/auth/logout', { method: 'POST' });
            } catch { /* network error — still clear local state */ }
            document.cookie = 'agntly_role=; path=/; max-age=0';
            document.cookie = 'agntly_redirect=; path=/; max-age=0';
            window.location.href = '/';
          }}
          className="bg-transparent border border-border text-t-2 font-mono text-[11px] px-[10px] py-[6px] tracking-[0.04em] hover:border-red hover:text-red transition-all cursor-pointer"
        >
          sign out
        </button>
      </div>
    </nav>
  );
}
