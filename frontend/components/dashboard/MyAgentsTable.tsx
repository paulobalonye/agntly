interface Agent {
  id: string;
  name: string;
  category: string;
  status: string;
  priceUsdc: string;
  calls24h: number;
  earnings24h: string;
  uptime: number;
}

const CATEGORY_COLORS: Record<string, { color: string; bg: string; abbr: string }> = {
  search: { color: '#4d9ef5', bg: 'rgba(77,158,245,0.12)', abbr: 'WS' },
  code: { color: '#9b7cf8', bg: 'rgba(155,124,248,0.12)', abbr: 'CE' },
  file: { color: '#00e5a0', bg: 'rgba(0,229,160,0.12)', abbr: 'PP' },
  data: { color: '#f5a623', bg: 'rgba(245,166,35,0.12)', abbr: 'DW' },
  api: { color: '#e05252', bg: 'rgba(224,82,82,0.12)', abbr: 'AR' },
  llm: { color: '#c084fc', bg: 'rgba(192,132,252,0.12)', abbr: 'SC' },
};

const DEFAULT_CATEGORY = { color: '#8fa8c0', bg: 'rgba(143,168,192,0.12)', abbr: 'AG' };

function getStatusPill(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-accent/10 text-accent border border-accent/25';
    case 'paused':
      return 'bg-amber/10 text-amber border border-amber/25';
    default:
      return 'bg-t-2/15 text-t-2 border border-border';
  }
}

function getStatusLabel(status: string): string {
  if (status === 'active') return 'online';
  if (status === 'paused') return 'paused';
  return 'offline';
}

interface MyAgentsTableProps {
  agents: Agent[];
}

export function MyAgentsTable({ agents }: MyAgentsTableProps) {
  return (
    <div className="bg-bg-1 border border-border overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] bg-bg-2 border-b border-border px-5 py-3">
        {['Agent', 'Status', 'Price', 'Calls / 24h', 'Earnings / 24h', 'Uptime'].map((col) => (
          <div
            key={col}
            className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase"
          >
            {col}
          </div>
        ))}
      </div>

      {/* Rows */}
      {agents.map((agent) => {
        const catStyle = CATEGORY_COLORS[agent.category] ?? DEFAULT_CATEGORY;

        return (
          <div
            key={agent.id}
            className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] px-5 py-4 border-b border-border last:border-b-0 hover:bg-bg-2/50 transition-colors cursor-pointer items-center"
          >
            {/* Name + icon */}
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 flex items-center justify-center font-mono text-[11px] font-medium flex-shrink-0 border"
                style={{
                  color: catStyle.color,
                  borderColor: catStyle.color + '30',
                  background: catStyle.bg,
                }}
              >
                {catStyle.abbr}
              </div>
              <div>
                <div className="text-[13px] text-t-0 font-medium">{agent.name}</div>
                <div className="font-mono text-[10px] text-t-2">{agent.id}</div>
              </div>
            </div>

            {/* Status pill */}
            <div>
              <span
                className={`inline-flex items-center gap-1 font-mono text-[10px] px-2 py-[3px] tracking-[0.06em] ${getStatusPill(agent.status)}`}
              >
                <span
                  className={`w-[4px] h-[4px] rounded-full ${
                    agent.status === 'active'
                      ? 'bg-accent'
                      : agent.status === 'paused'
                      ? 'bg-amber'
                      : 'bg-t-2'
                  }`}
                />
                {getStatusLabel(agent.status)}
              </span>
            </div>

            {/* Price */}
            <div className="font-mono text-[13px] text-accent">${agent.priceUsdc}</div>

            {/* Calls/24h */}
            <div className="font-mono text-[13px] text-t-0">{agent.calls24h.toLocaleString()}</div>

            {/* Earnings/24h */}
            <div className="font-mono text-[13px] text-accent">${agent.earnings24h}</div>

            {/* Uptime */}
            <div className="font-mono text-[13px] text-t-0">{agent.uptime.toFixed(1)}%</div>
          </div>
        );
      })}

      {agents.length === 0 && (
        <div className="px-5 py-8 text-center font-mono text-[12px] text-t-2">
          No agents found. List your first agent to get started.
        </div>
      )}
    </div>
  );
}
