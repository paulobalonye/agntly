import Link from 'next/link';

export function LandingNav() {
  return (
    <nav className="relative z-10 flex items-center justify-between px-12 py-5 border-b border-white/[0.04]">
      <div className="font-mono text-base font-medium text-accent flex items-center gap-2.5 tracking-tight">
        <span className="w-2 h-2 bg-accent rounded-full animate-pulse-dot" />
        AGNTLY.IO
      </div>
      <div className="flex gap-3 items-center">
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
    </nav>
  );
}
