'use client';

import { useState, useEffect } from 'react';

interface AgentRow {
  id: string;
  name: string;
  category: string;
  status: string;
  endpoint: string;
  priceUsdc: string;
  ownerId: string;
  createdAt: string;
}

function statusPill(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-accent/10 text-accent border border-accent/25';
    case 'paused':
      return 'bg-amber/10 text-amber border border-amber/25';
    default:
      return 'bg-t-2/15 text-t-2 border border-border';
  }
}

function truncate(s: string, len = 20): string {
  if (s.length <= len) return s;
  return s.slice(0, len) + '...';
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [stats, setStats] = useState<{ totalAgents: number; activeAgents: number; agentsByCategory: Record<string, number> }>({
    totalAgents: 0, activeAgents: 0, agentsByCategory: {},
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/agents').then((r) => r.json()),
      fetch('/api/admin/stats').then((r) => r.json()),
    ])
      .then(([agentsJson, statsJson]) => {
        if (Array.isArray(agentsJson?.data)) {
          setAgents(
            agentsJson.data.map((a: Record<string, unknown>) => ({
              id: String(a.id ?? ''),
              name: String(a.name ?? ''),
              category: String(a.category ?? ''),
              status: String(a.status ?? ''),
              endpoint: String(a.endpoint ?? a.endpointUrl ?? ''),
              priceUsdc: String(a.priceUsdc ?? a.price_usdc ?? '0'),
              ownerId: String(a.ownerId ?? a.owner_id ?? ''),
              createdAt: String(a.createdAt ?? a.created_at ?? ''),
            })),
          );
        }
        if (statsJson?.data?.agents) {
          setStats(statsJson.data.agents);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="relative z-10 min-h-screen px-8 py-8 max-w-[1400px] mx-auto">
      <div className="mb-8">
        <div className="font-mono text-[11px] text-red tracking-[0.1em] uppercase mb-2">admin</div>
        <h1 className="font-display text-[32px] font-semibold text-t-0 leading-tight">Agents</h1>
        <p className="font-mono text-[12px] text-t-2 mt-1">
          {stats.totalAgents} total · {stats.activeAgents} active
        </p>
      </div>

      {/* Category breakdown */}
      {Object.keys(stats.agentsByCategory).length > 0 && (
        <div className="flex gap-3 mb-6 flex-wrap">
          {Object.entries(stats.agentsByCategory).map(([cat, count]) => (
            <div key={cat} className="bg-bg-1 border border-border px-4 py-2">
              <div className="font-mono text-[10px] text-t-2 uppercase">{cat}</div>
              <div className="font-mono text-[18px] text-t-0 font-medium">{count}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-16 justify-center">
          <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          <span className="font-mono text-[12px] text-t-2">Loading agents...</span>
        </div>
      ) : (
        <div className="bg-bg-1 border border-border overflow-hidden">
          <div
            className="grid bg-bg-2 border-b border-border px-5 py-3"
            style={{ gridTemplateColumns: '2fr 1fr 80px 80px 1.5fr 120px' }}
          >
            {['Agent', 'Category', 'Status', 'Price', 'Endpoint', 'Owner'].map((col) => (
              <div key={col} className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase">{col}</div>
            ))}
          </div>

          {agents.map((agent) => (
            <div
              key={agent.id}
              className="grid px-5 py-3 border-b border-border last:border-b-0 items-center hover:bg-bg-2/50 transition-colors"
              style={{ gridTemplateColumns: '2fr 1fr 80px 80px 1.5fr 120px' }}
            >
              <div>
                <div className="font-mono text-[12px] text-t-0">{agent.name}</div>
                <div className="font-mono text-[10px] text-t-2">{truncate(agent.id, 16)}</div>
              </div>
              <div className="font-mono text-[11px] text-t-1">{agent.category}</div>
              <div>
                <span className={`inline-block font-mono text-[10px] px-2 py-[2px] ${statusPill(agent.status)}`}>
                  {agent.status}
                </span>
              </div>
              <div className="font-mono text-[12px] text-accent">${agent.priceUsdc}</div>
              <div className="font-mono text-[10px] text-t-2 overflow-hidden text-ellipsis whitespace-nowrap">
                {truncate(agent.endpoint, 30)}
              </div>
              <div className="font-mono text-[10px] text-t-2 overflow-hidden text-ellipsis whitespace-nowrap">
                {truncate(agent.ownerId, 12)}
              </div>
            </div>
          ))}

          {agents.length === 0 && (
            <div className="px-5 py-8 text-center font-mono text-[12px] text-t-2">No agents registered yet.</div>
          )}
        </div>
      )}
    </main>
  );
}
