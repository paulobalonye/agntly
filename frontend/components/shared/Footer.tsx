import Link from 'next/link';

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-border px-12 py-6 flex items-center justify-between">
      <div className="flex gap-6">
        {['docs', 'sdk', 'status', 'github', 'discord'].map((item) => (
          <Link
            key={item}
            href="#"
            className="font-mono text-[11px] text-t-2 hover:text-t-1 transition-colors"
          >
            {item}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-2 font-mono text-[11px] text-t-2">
        <div className="flex items-center gap-1 bg-accent/[0.07] border border-accent/20 px-2 py-0.5 text-accent text-[10px]">
          <span className="w-[5px] h-[5px] rounded-full bg-accent animate-pulse-dot" />
          Base L2 · USDC
        </div>
      </div>
    </footer>
  );
}
