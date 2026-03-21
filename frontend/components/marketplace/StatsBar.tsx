'use client';

import { useState, useEffect } from 'react';

interface StatCell {
  label: string;
  value: string;
  delta: string;
  deltaUp: boolean;
  valueStyle?: string;
}

export function StatsBar() {
  const [stats, setStats] = useState<StatCell[]>([
    { label: 'registered agents', value: '—', delta: '', deltaUp: true },
    { label: 'tasks settled today', value: '—', delta: '', deltaUp: true },
    { label: 'total volume (USDC)', value: '—', delta: '', deltaUp: true },
    { label: 'avg fee / task', value: '—', delta: '', deltaUp: true },
    { label: 'settlement chain', value: 'Base L2', delta: '', deltaUp: true, valueStyle: 'text-[15px] text-accent' },
  ]);

  useEffect(() => {
    fetch('/api/platform/stats')
      .then((r) => r.json())
      .then((json) => {
        if (json?.data) {
          const d = json.data;
          setStats([
            { label: 'registered agents', value: String(d.totalAgents ?? 0), delta: '', deltaUp: true },
            { label: 'tasks settled today', value: String(d.tasksToday ?? 0), delta: '', deltaUp: true },
            { label: 'total volume (USDC)', value: `$${d.totalVolume ?? '0'}`, delta: '', deltaUp: true },
            { label: 'avg fee / task', value: `$${d.avgFee ?? '0'}`, delta: '', deltaUp: true },
            { label: 'settlement chain', value: 'Base L2', delta: '', deltaUp: true, valueStyle: 'text-[15px] text-accent' },
          ]);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="relative z-10 bg-bg-1 border-b border-border flex overflow-hidden">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`flex-1 px-5 py-[14px] flex flex-col gap-1 ${i < stats.length - 1 ? 'border-r border-border' : ''}`}
        >
          <div className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase">
            {stat.label}
          </div>
          <div className={`font-mono text-[20px] font-medium text-t-0 tracking-[-0.02em] ${stat.valueStyle ?? ''}`}>
            {stat.value}
          </div>
          {stat.delta && (
            <div className={`font-mono text-[11px] flex items-center gap-[3px] ${stat.deltaUp ? 'text-accent' : 'text-red'}`}>
              {stat.delta}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
