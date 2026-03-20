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

function getStatusClasses(status: string): string {
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
  if (status === 'paused') return 'busy';
  return 'offline';
}

function isFeatured(agent: Agent): boolean {
  if (!agent.featuredUntil) return false;
  return new Date(agent.featuredUntil) > new Date();
}

interface AgentCardProps {
  agent: Agent;
  onSelect: (agent: Agent) => void;
}

export function AgentCard({ agent, onSelect }: AgentCardProps) {
  const catStyle = CATEGORY_COLORS[agent.category] ?? DEFAULT_CATEGORY;
  const featured = isFeatured(agent);
  const statusLabel = getStatusLabel(agent.status);

  const calls24h = agent.callsTotal > 0
    ? Math.round(agent.callsTotal / 30).toLocaleString()
    : '—';

  const uptime = agent.uptimePct != null
    ? `${agent.uptimePct.toFixed(1)}%`
    : '—';

  const latency = agent.timeoutMs != null
    ? `${(agent.timeoutMs / 1000).toFixed(1)}s`
    : '—';

  return (
    <div
      className={[
        'bg-bg-1 border cursor-pointer relative overflow-hidden',
        'transition-all duration-200 group',
        featured ? 'border-accent/30' : 'border-border hover:border-border-2',
      ].join(' ')}
      onClick={() => onSelect(agent)}
    >
      {/* Top accent line */}
      <div
        className={[
          'absolute top-0 left-0 right-0 h-px transition-colors duration-200',
          featured ? 'bg-accent' : 'bg-transparent group-hover:bg-accent',
        ].join(' ')}
      />

      {/* Featured badge */}
      {featured && (
        <div className="absolute top-0 right-5 bg-accent text-bg-0 font-mono text-[9px] font-medium px-2 py-[3px] tracking-[0.08em] uppercase">
          featured
        </div>
      )}

      {/* Card header */}
      <div className="px-4 pt-[14px] pb-[10px] flex items-start justify-between gap-[10px]">
        <div
          className="w-9 h-9 flex items-center justify-center font-mono text-[13px] font-medium flex-shrink-0 border"
          style={{ color: catStyle.color, borderColor: catStyle.color + '30', background: catStyle.bg }}
        >
          {catStyle.abbr}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-medium text-t-0 whitespace-nowrap overflow-hidden text-ellipsis mb-0.5">
            {agent.name}
          </div>
          <div className="font-mono text-[10px] text-t-2 tracking-[0.04em]">
            {agent.id}
          </div>
        </div>
        <div className={`font-mono text-[10px] px-2 py-[3px] tracking-[0.06em] flex-shrink-0 flex items-center gap-1 ${getStatusClasses(agent.status)}`}>
          <span className={`w-[5px] h-[5px] rounded-full ${
            agent.status === 'active' ? 'bg-accent' :
            agent.status === 'paused' ? 'bg-amber' : 'bg-t-2'
          }`} />
          {statusLabel}
        </div>
      </div>

      {/* Description */}
      <div className="px-4 pb-3 text-[12px] text-t-1 leading-[1.6]">
        {agent.description}
      </div>

      {/* Tags */}
      <div className="px-4 pb-3 flex flex-wrap gap-[5px]">
        {agent.tags.map((tag, i) => (
          <span
            key={tag}
            className={[
              'font-mono text-[10px] border px-[7px] py-[2px] tracking-[0.03em]',
              i === 0
                ? 'text-blue border-blue/25 bg-blue/[0.07]'
                : 'text-t-2 bg-bg-3 border-border',
            ].join(' ')}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Metrics */}
      <div className="border-t border-border grid grid-cols-3">
        <div className="px-3 py-[10px] border-r border-border flex flex-col gap-[3px]">
          <div className="font-mono text-[9px] text-t-2 tracking-[0.08em] uppercase">calls / 24h</div>
          <div className="font-mono text-[13px] font-medium text-t-0">{calls24h}</div>
        </div>
        <div className="px-3 py-[10px] border-r border-border flex flex-col gap-[3px]">
          <div className="font-mono text-[9px] text-t-2 tracking-[0.08em] uppercase">uptime</div>
          <div className="font-mono text-[13px] font-medium text-accent">{uptime}</div>
        </div>
        <div className="px-3 py-[10px] flex flex-col gap-[3px]">
          <div className="font-mono text-[9px] text-t-2 tracking-[0.08em] uppercase">latency</div>
          <div className="font-mono text-[13px] font-medium text-t-0">{latency}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-[10px] flex items-center justify-between">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-[16px] font-medium text-accent">${agent.priceUsdc}</span>
          <span className="font-mono text-[10px] text-t-2">USDC / call</span>
        </div>
        <button
          className="bg-transparent border border-accent text-accent font-mono text-[11px] px-[14px] py-[6px] tracking-[0.04em] hover:bg-accent hover:text-bg-0 transition-all"
          onClick={(e) => { e.stopPropagation(); onSelect(agent); }}
        >
          connect →
        </button>
      </div>
    </div>
  );
}
