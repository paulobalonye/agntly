'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface TickerState {
  tasks: string;
  vol: string;
  fee: string;
}

function randomTicker(): TickerState {
  return {
    tasks: (Math.floor(Math.random() * 500) + 93800).toLocaleString(),
    vol: '$' + (Math.random() * 2 + 47).toFixed(2) + 'k',
    fee: '$' + (Math.random() * 0.001 + 0.0025).toFixed(4),
  };
}

export function MarketplaceNav() {
  const [ticker, setTicker] = useState<TickerState>({ tasks: '94,201', vol: '$48.12k', fee: '$0.0028' });

  useEffect(() => {
    setTicker(randomTicker());
    const id = setInterval(() => setTicker(randomTicker()), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <nav className="sticky top-0 z-[100] flex items-center gap-8 px-8 h-[52px] border-b border-border bg-bg-0/[0.92] backdrop-blur-[12px]">
      {/* Logo */}
      <div className="font-mono text-[15px] font-medium text-accent tracking-[-0.02em] flex items-center gap-2 flex-shrink-0">
        <span className="w-[7px] h-[7px] bg-accent rounded-full animate-pulse-dot" />
        AGNTLY.IO
      </div>

      {/* Nav links */}
      <ul className="flex gap-6 list-none flex-1">
        <li>
          <Link href="/marketplace" className="font-mono text-[13px] text-accent tracking-[0.02em] hover:text-t-0 transition-colors">
            registry
          </Link>
        </li>
        <li>
          <Link href="#" className="font-mono text-[13px] text-t-1 tracking-[0.02em] hover:text-t-0 transition-colors">
            my_agents
          </Link>
        </li>
        <li>
          <Link href="#" className="font-mono text-[13px] text-t-1 tracking-[0.02em] hover:text-t-0 transition-colors">
            wallet
          </Link>
        </li>
        <li>
          <Link href="#" className="font-mono text-[13px] text-t-1 tracking-[0.02em] hover:text-t-0 transition-colors">
            docs
          </Link>
        </li>
        <li>
          <Link href="#" className="font-mono text-[13px] text-t-1 tracking-[0.02em] hover:text-t-0 transition-colors">
            analytics
          </Link>
        </li>
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

        <button className="bg-transparent border border-border-2 text-t-1 font-mono text-[11px] px-[14px] py-[6px] tracking-[0.04em] hover:border-accent hover:text-accent transition-all">
          connect wallet
        </button>
        <button className="bg-accent border border-accent text-bg-0 font-mono text-[11px] font-medium px-[16px] py-[6px] tracking-[0.04em] hover:bg-accent-2 hover:border-accent-2 transition-all">
          + list agent
        </button>
      </div>
    </nav>
  );
}
