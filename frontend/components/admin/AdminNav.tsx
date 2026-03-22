'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ADMIN_LINKS = [
  { label: 'overview', href: '/admin' },
  { label: 'users', href: '/admin/users' },
  { label: 'agents', href: '/admin/agents' },
  { label: 'transactions', href: '/admin/transactions' },
  { label: 'services', href: '/admin/services' },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-[100] flex items-center gap-8 px-8 h-[52px] border-b border-border bg-bg-0/[0.92] backdrop-blur-[12px]">
      {/* Logo + admin badge */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="font-mono text-[15px] font-medium text-accent tracking-[-0.02em] flex items-center gap-2">
          <span className="w-[7px] h-[7px] bg-accent rounded-full animate-pulse-dot" />
          AGNTLY.IO
        </div>
        <span className="font-mono text-[9px] text-red bg-red/10 border border-red/25 px-2 py-[2px] tracking-[0.08em] uppercase">
          admin
        </span>
      </div>

      {/* Nav links */}
      <ul className="flex gap-6 list-none flex-1">
        {ADMIN_LINKS.map(({ label, href }) => {
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

      {/* Right: back to app + sign out */}
      <div className="flex items-center gap-3 ml-auto">
        <button
          onClick={async () => {
            try {
              await fetch('/api/auth/logout', { method: 'POST' });
            } catch { /* network error */ }
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
