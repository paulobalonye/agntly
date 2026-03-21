'use client';

import Link from 'next/link';
import { useState } from 'react';

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="relative z-[60] flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/[0.04]">
        <div className="font-mono text-base font-medium text-accent flex items-center gap-2.5 tracking-tight">
          <span className="w-2 h-2 bg-accent rounded-full animate-pulse-dot" />
          AGNTLY.IO
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex gap-3 items-center">
          <Link
            href="/marketplace"
            className="bg-transparent border border-border-2 text-t-1 font-mono text-xs px-[18px] py-2 hover:border-accent hover:text-accent transition-all tracking-wider"
          >
            browse registry
          </Link>
          <Link
            href="/auth/login?redirect=%2Fonboard%3Frole%3Dbuilder"
            className="bg-transparent border border-border-2 text-t-1 font-mono text-xs px-[18px] py-2 hover:border-accent hover:text-accent transition-all tracking-wider"
          >
            list your agent
          </Link>
          <Link
            href="/auth/login"
            className="bg-accent border-none text-bg-0 font-mono text-xs font-medium px-5 py-2 hover:bg-accent-2 transition-all tracking-wider"
          >
            get started
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden flex flex-col gap-[5px] p-2 relative z-[70]"
          aria-label="Toggle menu"
        >
          <span className={`w-5 h-px bg-t-1 transition-transform duration-200 ${open ? 'rotate-45 translate-y-[6px]' : ''}`} />
          <span className={`w-5 h-px bg-t-1 transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
          <span className={`w-5 h-px bg-t-1 transition-transform duration-200 ${open ? '-rotate-45 -translate-y-[6px]' : ''}`} />
        </button>
      </nav>

      {/* Mobile menu — fixed overlay so it's above everything */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-bg-0/80 backdrop-blur-sm z-[55] md:hidden"
            onClick={() => setOpen(false)}
          />
          {/* Menu panel */}
          <div className="fixed top-[61px] left-0 right-0 bg-bg-0 border-b border-border p-6 flex flex-col gap-1 md:hidden z-[65]">
            <Link href="/marketplace" onClick={() => setOpen(false)}
              className="font-mono text-sm text-t-1 py-3 border-b border-border/50 active:text-accent">
              browse registry
            </Link>
            <Link href="/auth/login?redirect=%2Fonboard%3Frole%3Dbuilder" onClick={() => setOpen(false)}
              className="font-mono text-sm text-t-1 py-3 border-b border-border/50 active:text-accent">
              list your agent
            </Link>
            <Link href="/docs" onClick={() => setOpen(false)}
              className="font-mono text-sm text-t-1 py-3 border-b border-border/50 active:text-accent">
              docs
            </Link>
            <Link href="/auth/login" onClick={() => setOpen(false)}
              className="bg-accent text-bg-0 font-mono text-sm font-medium px-5 py-3 text-center mt-3">
              get started
            </Link>
          </div>
        </>
      )}
    </>
  );
}
