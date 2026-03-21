import type { Agent } from './types';

const CATEGORY_COLORS: Record<string, { color: string; bg: string; abbr: string }> = {
  search: { color: '#4d9ef5', bg: 'rgba(77,158,245,0.12)', abbr: 'WS' },
  code: { color: '#9b7cf8', bg: 'rgba(155,124,248,0.12)', abbr: 'CE' },
  file: { color: '#00e5a0', bg: 'rgba(0,229,160,0.12)', abbr: 'PP' },
  data: { color: '#f5a623', bg: 'rgba(245,166,35,0.12)', abbr: 'DW' },
  api: { color: '#e05252', bg: 'rgba(224,82,82,0.12)', abbr: 'AR' },
  llm: { color: '#c084fc', bg: 'rgba(192,132,252,0.12)', abbr: 'SC' },
};

const DEFAULT_CATEGORY = { color: '#8fa8c0', bg: 'rgba(143,168,192,0.12)', abbr: 'AG' };

interface LeaderboardProps {
  agents?: Agent[];
}

export function Leaderboard({ agents }: LeaderboardProps) {
  if (!agents || agents.length === 0) {
    return (
      <div>
        <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-3 pb-2 border-b border-border">
          top earners — 24h
        </div>
        <div className="px-2 py-6 text-center">
          <div className="font-mono text-[12px] text-t-2">
            No agents ranked yet.
          </div>
        </div>
      </div>
    );
  }

  const sorted = [...agents]
    .sort((a, b) => {
      const earningsA = a.callsTotal * parseFloat(a.priceUsdc);
      const earningsB = b.callsTotal * parseFloat(b.priceUsdc);
      return earningsB - earningsA;
    })
    .slice(0, 5);

  return (
    <div>
      <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-3 pb-2 border-b border-border">
        top earners — 24h
      </div>
      <div className="flex flex-col">
        {sorted.map((agent, i) => {
          const catStyle = CATEGORY_COLORS[agent.category] ?? DEFAULT_CATEGORY;
          const earnings = '$' + (agent.callsTotal * parseFloat(agent.priceUsdc)).toFixed(2);

          return (
            <div key={agent.id} className="flex items-center gap-[10px] py-2 border-b border-border cursor-pointer hover:bg-bg-2/50 transition-colors">
              <span className="font-mono text-[11px] text-t-2 w-[18px] text-center flex-shrink-0">
                {i + 1}
              </span>
              <div
                className="w-6 h-6 flex items-center justify-center font-mono text-[9px] font-medium flex-shrink-0 border"
                style={{ color: catStyle.color, borderColor: catStyle.color + '30', background: catStyle.bg }}
              >
                {catStyle.abbr}
              </div>
              <span className="flex-1 text-[12px] text-t-0 overflow-hidden text-ellipsis whitespace-nowrap min-w-0">
                {agent.name}
              </span>
              <span className="font-mono text-[11px] text-accent flex-shrink-0">
                {earnings}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
