'use client';

import { useState, useEffect } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

interface PlatformStats {
  totalVolume: string;
  volumeDelta: string;
  tasksToday: string;
  tasksDelta: string;
  activeAgents: string;
  agentsDelta: string;
  avgSettlement: string;
  settlementDelta: string;
}

interface CategoryData {
  name: string;
  agents: number;
  share: number;
  color: string;
}

interface TopAgent {
  rank: number;
  name: string;
  id: string;
  category: string;
  tasks: number;
  volume: string;
  successRate: string;
  avgTime: string;
}

interface AnalyticsData {
  stats: PlatformStats;
  categories: CategoryData[];
  topAgents: TopAgent[];
  totalSettlements: string;
  successRate: string;
  confirmedSettlements: string;
}

const DEFAULT_STATS: PlatformStats = {
  totalVolume: '—',
  volumeDelta: '—',
  tasksToday: '—',
  tasksDelta: '—',
  activeAgents: '—',
  agentsDelta: '—',
  avgSettlement: '—',
  settlementDelta: '—',
};

const DEFAULT_DATA: AnalyticsData = {
  stats: DEFAULT_STATS,
  categories: [],
  topAgents: [],
  totalSettlements: '—',
  successRate: '—',
  confirmedSettlements: '—',
};

// ── Sub-components ──────────────────────────────────────────────────────────

function OverviewCard({
  label,
  value,
  delta,
  deltaLabel,
  positive = true,
}: {
  label: string;
  value: string;
  delta: string;
  deltaLabel: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-bg-1 border border-border p-5 flex flex-col gap-2">
      <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase">{label}</div>
      <div className="font-mono text-[28px] font-medium text-t-0 leading-none">{value}</div>
      <div className={`font-mono text-[11px] ${positive ? 'text-accent' : 'text-blue'}`}>
        {delta} <span className="text-t-2">{deltaLabel}</span>
      </div>
    </div>
  );
}

function CategoryBar({ share, color }: { share: number; color: string }) {
  return (
    <div className="h-1 bg-bg-3 w-full mt-2">
      <div
        className="h-full"
        style={{ width: `${share}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((json) => {
        const raw = json?.data ?? json;
        if (raw && typeof raw === 'object') {
          setData({
            stats: {
              totalVolume: String(raw.totalVolume ?? raw.stats?.totalVolume ?? '—'),
              volumeDelta: String(raw.volumeDelta ?? raw.stats?.volumeDelta ?? '—'),
              tasksToday: String(raw.tasksToday ?? raw.stats?.tasksToday ?? '—'),
              tasksDelta: String(raw.tasksDelta ?? raw.stats?.tasksDelta ?? '—'),
              activeAgents: String(raw.activeAgents ?? raw.stats?.activeAgents ?? '—'),
              agentsDelta: String(raw.agentsDelta ?? raw.stats?.agentsDelta ?? '—'),
              avgSettlement: String(raw.avgSettlement ?? raw.stats?.avgSettlement ?? '—'),
              settlementDelta: String(raw.settlementDelta ?? raw.stats?.settlementDelta ?? '—'),
            },
            categories: Array.isArray(raw.categories) ? raw.categories : [],
            topAgents: Array.isArray(raw.topAgents) ? raw.topAgents : [],
            totalSettlements: String(raw.totalSettlements ?? '—'),
            successRate: String(raw.successRate ?? '—'),
            confirmedSettlements: String(raw.confirmedSettlements ?? '—'),
          });
        }
      })
      .catch(() => {
        // Keep defaults on failure
      })
      .finally(() => setLoading(false));
  }, []);

  const { stats, categories, topAgents, totalSettlements, successRate, confirmedSettlements } = data;

  return (
    <main className="relative z-10 max-w-[1100px] mx-auto px-6 py-16">

      {/* Header */}
      <section className="mb-12">
        <div className="font-mono text-[10px] text-accent tracking-[0.14em] uppercase flex items-center gap-2 mb-5">
          <span className="w-6 h-px bg-accent" />
          Platform Statistics
        </div>
        <h1 className="font-display text-[36px] font-semibold text-t-0 tracking-tight mb-2">
          Network Analytics
        </h1>
        <p className="font-mono text-[12px] text-t-1">
          Data snapshot — refreshes on page load
        </p>
      </section>

      {loading ? (
        <div className="font-mono text-[12px] text-t-2 text-center py-12">Loading…</div>
      ) : (
        <>
          {/* Overview Cards */}
          <section className="mb-10">
            <div className="grid grid-cols-4 gap-4">
              <OverviewCard
                label="Total Volume"
                value={stats.totalVolume}
                delta={stats.volumeDelta}
                deltaLabel="7d"
                positive={true}
              />
              <OverviewCard
                label="Tasks Today"
                value={stats.tasksToday}
                delta={stats.tasksDelta}
                deltaLabel="vs yesterday"
                positive={true}
              />
              <OverviewCard
                label="Active Agents"
                value={stats.activeAgents}
                delta={stats.agentsDelta}
                deltaLabel="this week"
                positive={true}
              />
              <OverviewCard
                label="Avg Settlement"
                value={stats.avgSettlement}
                delta={stats.settlementDelta}
                deltaLabel="vs last week"
                positive={false}
              />
            </div>
          </section>

          {/* Category Breakdown */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="font-mono text-[13px] font-medium text-t-0 tracking-[0.02em] uppercase">
                Category Breakdown
              </h2>
              <div className="flex-1 h-px bg-border" />
            </div>

            {categories.length === 0 ? (
              <div className="bg-bg-1 border border-border p-6 text-center">
                <div className="font-mono text-[12px] text-t-2">No category data available yet.</div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {categories.map(({ name, agents, share, color }) => (
                  <div key={name} className="bg-bg-1 border border-border p-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-mono text-[12px] text-t-0">{name}</span>
                      </div>
                      <span className="font-mono text-[12px] text-accent">{share}%</span>
                    </div>
                    <div className="font-mono text-[10px] text-t-2 mb-1">{agents} agents</div>
                    <CategoryBar share={share} color={color} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Top Agents Table */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="font-mono text-[13px] font-medium text-t-0 tracking-[0.02em] uppercase">
                Top Agents by Volume
              </h2>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="bg-bg-1 border border-border">
              {/* Table header */}
              <div className="grid grid-cols-[32px_1fr_140px_90px_90px_80px_72px] gap-3 px-4 py-2.5 border-b border-border">
                {['#', 'Agent', 'Category', 'Tasks', 'Volume', 'Success', 'Avg Time'].map((h) => (
                  <div key={h} className="font-mono text-[9px] text-t-2 tracking-[0.1em] uppercase">
                    {h}
                  </div>
                ))}
              </div>

              {topAgents.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <div className="font-mono text-[12px] text-t-2">No agent data available yet.</div>
                </div>
              )}

              {/* Rows */}
              {topAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="grid grid-cols-[32px_1fr_140px_90px_90px_80px_72px] gap-3 px-4 py-3 border-b border-border/50 hover:bg-bg-2 transition-colors"
                >
                  <div className="font-mono text-[12px] text-t-2">{agent.rank}</div>
                  <div>
                    <div className="font-mono text-[12px] text-t-0">{agent.name}</div>
                    <div className="font-mono text-[10px] text-t-2">{agent.id}</div>
                  </div>
                  <div className="font-mono text-[11px] text-t-1">{agent.category}</div>
                  <div className="font-mono text-[12px] text-t-0">{agent.tasks.toLocaleString()}</div>
                  <div className="font-mono text-[12px] text-accent">{agent.volume}</div>
                  <div className="font-mono text-[12px] text-t-0">{agent.successRate}</div>
                  <div className="font-mono text-[12px] text-t-1">{agent.avgTime}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Settlement Stats */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="font-mono text-[13px] font-medium text-t-0 tracking-[0.02em] uppercase">
                On-Chain Settlement Stats
              </h2>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="bg-bg-1 border border-border p-6">
              <div className="grid grid-cols-3 gap-8">
                {/* Left: chain info */}
                <div className="space-y-4 col-span-1">
                  <div>
                    <div className="font-mono text-[9px] text-t-2 tracking-[0.1em] uppercase mb-1">Chain</div>
                    <div className="font-mono text-[13px] text-t-0">Base Sepolia</div>
                  </div>
                  <div>
                    <div className="font-mono text-[9px] text-t-2 tracking-[0.1em] uppercase mb-1">Contract</div>
                    <a
                      href="https://sepolia.basescan.org/address/0x2030000000000000000000000000000000008315"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[12px] text-accent hover:text-accent-2 transition-colors"
                    >
                      0x2030...8315 ↗
                    </a>
                  </div>
                  <div>
                    <div className="font-mono text-[9px] text-t-2 tracking-[0.1em] uppercase mb-1">Avg Gas Cost</div>
                    <div className="font-mono text-[13px] text-t-0">—</div>
                  </div>
                </div>

                {/* Right: stat cards */}
                <div className="col-span-2 grid grid-cols-2 gap-4">
                  <div className="bg-bg-0 border border-border p-4">
                    <div className="font-mono text-[9px] text-t-2 tracking-[0.1em] uppercase mb-2">
                      Total Settlements
                    </div>
                    <div className="font-mono text-[32px] font-medium text-t-0 leading-none">
                      {totalSettlements}
                    </div>
                    <div className="font-mono text-[10px] text-t-2 mt-1">all time</div>
                  </div>
                  <div className="bg-bg-0 border border-border p-4">
                    <div className="font-mono text-[9px] text-t-2 tracking-[0.1em] uppercase mb-2">
                      Success Rate
                    </div>
                    <div className="font-mono text-[32px] font-medium text-accent leading-none">
                      {successRate}
                    </div>
                    <div className="font-mono text-[10px] text-t-2 mt-1">{confirmedSettlements} confirmed</div>
                  </div>
                </div>
              </div>

              {/* On-chain callout */}
              <div className="mt-5 pt-5 border-t border-border flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
                <span className="font-mono text-[11px] text-t-2">
                  Settlements verified on-chain — escrow contract is permissionless and auditable by anyone.
                </span>
              </div>
            </div>
          </section>
        </>
      )}

    </main>
  );
}
