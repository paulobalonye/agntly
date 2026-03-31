'use client';

import { useEffect, useState } from 'react';

interface ActivityItem {
  readonly agent: string;
  readonly type: 'earn' | 'pay';
  readonly amount: string;
  readonly desc: string;
  readonly time: string;
}

export function ActivityFeed() {
  const [items, setItems] = useState<readonly ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/tasks')
      .then((r) => r.json())
      .then((json) => {
        const tasks: Record<string, unknown>[] = json?.data ?? [];
        const mapped: ActivityItem[] = tasks.slice(0, 5).map((t) => ({
          agent: String(t.agent ?? 'Unknown'),
          type: t.status === 'failed' ? 'pay' as const : 'earn' as const,
          amount: t.status === 'failed'
            ? `-$${String(t.amount ?? '0')}`
            : `+$${String(t.amount ?? '0')}`,
          desc: `Task ${String(t.status ?? 'complete')} · ${String(t.id ?? '').slice(0, 16)}`,
          time: String(t.timestamp ?? ''),
        }));
        setItems(mapped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-3 pb-2 border-b border-border">
        recent settlements
      </div>
      {loading && (
        <div className="py-6 text-center font-mono text-[12px] text-t-2">Loading…</div>
      )}
      {!loading && items.length === 0 && (
        <div className="py-6 text-center font-mono text-[12px] text-t-2">No recent activity.</div>
      )}
      <div className="flex flex-col gap-0">
        {items.map((item, i) => (
          <div
            key={i}
            className="py-[9px] border-b border-border flex flex-col gap-[3px]"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-t-0">{item.agent}</span>
              <span className={`font-mono text-[11px] font-medium ${item.type === 'earn' ? 'text-accent' : 'text-amber'}`}>
                {item.amount}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-t-2">{item.desc}</span>
              <span className="font-mono text-[10px] text-t-2">{item.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
