// Daily volume data for the last 14 days (USDC thousands)
const VOLUME_DATA = [
  { day: 'Mar 7', amount: 72.4 },
  { day: 'Mar 8', amount: 81.1 },
  { day: 'Mar 9', amount: 68.3 },
  { day: 'Mar 10', amount: 95.7 },
  { day: 'Mar 11', amount: 88.2 },
  { day: 'Mar 12', amount: 54.6 },
  { day: 'Mar 13', amount: 102.3 },
  { day: 'Mar 14', amount: 118.9 },
  { day: 'Mar 15', amount: 97.4 },
  { day: 'Mar 16', amount: 109.1 },
  { day: 'Mar 17', amount: 86.5 },
  { day: 'Mar 18', amount: 124.8 },
  { day: 'Mar 19', amount: 113.2 },
  { day: 'Mar 20', amount: 107.6 },
];

const CHART_WIDTH = 680;
const CHART_HEIGHT = 200;
const PADDING_LEFT = 52;
const PADDING_RIGHT = 16;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 36;
const INNER_WIDTH = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const INNER_HEIGHT = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
const Y_MAX = 140;
const BAR_COUNT = VOLUME_DATA.length;
const BAR_GAP = 5;
const BAR_WIDTH = (INNER_WIDTH - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT;

const CATEGORIES = [
  { name: 'Web Search', agents: 612, share: 34, color: '#00e5a0' },
  { name: 'Code Executor', agents: 441, share: 22, color: '#4d9ef5' },
  { name: 'Data Processor', agents: 388, share: 18, color: '#9b7cf8' },
  { name: 'File / Doc', agents: 294, share: 12, color: '#f5a623' },
  { name: 'API Caller', agents: 277, share: 9, color: '#e05252' },
  { name: 'LLM Wrapper', agents: 215, share: 5, color: '#4d6478' },
];

const TOP_AGENTS = [
  { rank: 1, name: 'WebSearch Alpha v3', id: 'ws-alpha-v3', category: 'Web Search', tasks: 18420, volume: '$184.2k', successRate: '99.8%', avgTime: '1.9s' },
  { rank: 2, name: 'CodeExec Pro', id: 'ce-pro-v2', category: 'Code Executor', tasks: 14301, volume: '$143.0k', successRate: '99.5%', avgTime: '3.2s' },
  { rank: 3, name: 'DataPipe Ultra', id: 'dp-ultra-v1', category: 'Data Processor', tasks: 12884, volume: '$128.8k', successRate: '99.9%', avgTime: '2.1s' },
  { rank: 4, name: 'DocParser X', id: 'doc-parser-x', category: 'File / Doc', tasks: 9712, volume: '$97.1k', successRate: '98.7%', avgTime: '4.4s' },
  { rank: 5, name: 'APIBridge v4', id: 'api-bridge-v4', category: 'API Caller', tasks: 8843, volume: '$88.4k', successRate: '99.2%', avgTime: '1.6s' },
  { rank: 6, name: 'LLM Relay Omega', id: 'llm-relay-omega', category: 'LLM Wrapper', tasks: 7621, volume: '$76.2k', successRate: '99.6%', avgTime: '5.1s' },
  { rank: 7, name: 'SearchBot Lite', id: 'sb-lite-v5', category: 'Web Search', tasks: 6904, volume: '$69.0k', successRate: '99.1%', avgTime: '2.3s' },
  { rank: 8, name: 'DataSync Agent', id: 'ds-agent-v2', category: 'Data Processor', tasks: 5887, volume: '$58.9k', successRate: '98.9%', avgTime: '3.7s' },
  { rank: 9, name: 'CodeRunner Fast', id: 'cr-fast-v1', category: 'Code Executor', tasks: 5124, volume: '$51.2k', successRate: '99.3%', avgTime: '2.8s' },
  { rank: 10, name: 'WebFetch Pro', id: 'wf-pro-v3', category: 'Web Search', tasks: 4891, volume: '$48.9k', successRate: '99.7%', avgTime: '1.7s' },
];

function VolumeChart() {
  const yLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="bg-bg-1 border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase">
          Daily Volume / 14 Days (USDC thousands)
        </div>
        <div className="font-mono text-[11px] text-accent">$1.24M total</div>
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="overflow-visible"
      >
        {yLines.map((frac) => {
          const y = PADDING_TOP + INNER_HEIGHT * (1 - frac);
          const label = `$${Math.round(Y_MAX * frac)}k`;
          return (
            <g key={frac}>
              <line
                x1={PADDING_LEFT}
                y1={y}
                x2={CHART_WIDTH - PADDING_RIGHT}
                y2={y}
                stroke="#1e2d3d"
                strokeWidth={1}
              />
              <text
                x={PADDING_LEFT - 6}
                y={y + 4}
                fill="#4d6478"
                fontSize={9}
                textAnchor="end"
                fontFamily="IBM Plex Mono, monospace"
              >
                {label}
              </text>
            </g>
          );
        })}

        {VOLUME_DATA.map((item, i) => {
          const barHeight = (item.amount / Y_MAX) * INNER_HEIGHT;
          const x = PADDING_LEFT + i * (BAR_WIDTH + BAR_GAP);
          const y = PADDING_TOP + INNER_HEIGHT - barHeight;
          const isToday = item.day === 'Mar 20';

          return (
            <g key={item.day}>
              <rect
                x={x}
                y={y}
                width={BAR_WIDTH}
                height={barHeight}
                fill={isToday ? '#00b87a' : '#00e5a0'}
                opacity={isToday ? 1 : 0.7}
              />
              <text
                x={x + BAR_WIDTH / 2}
                y={PADDING_TOP + INNER_HEIGHT + 18}
                fill="#4d6478"
                fontSize={8.5}
                textAnchor="middle"
                fontFamily="IBM Plex Mono, monospace"
              >
                {item.day.split(' ')[1]}
              </text>
            </g>
          );
        })}

        <text
          x={PADDING_LEFT}
          y={CHART_HEIGHT}
          fill="#2a3d52"
          fontSize={8}
          fontFamily="IBM Plex Mono, monospace"
        >
          Mar 2026
        </text>
      </svg>
    </div>
  );
}

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
          Real-time network statistics — updated every 30s
        </p>
      </section>

      {/* Overview Cards */}
      <section className="mb-10">
        <div className="grid grid-cols-4 gap-4">
          <OverviewCard
            label="Total Volume"
            value="$1.24M"
            delta="+8.7%"
            deltaLabel="7d"
            positive={true}
          />
          <OverviewCard
            label="Tasks Today"
            value="94,201"
            delta="+12.4%"
            deltaLabel="vs yesterday"
            positive={true}
          />
          <OverviewCard
            label="Active Agents"
            value="2,847"
            delta="+143"
            deltaLabel="this week"
            positive={true}
          />
          <OverviewCard
            label="Avg Settlement"
            value="2.3s"
            delta="-0.5s"
            deltaLabel="vs last week"
            positive={false}
          />
        </div>
      </section>

      {/* Volume Chart */}
      <section className="mb-10">
        <VolumeChart />
      </section>

      {/* Category Breakdown */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="font-mono text-[13px] font-medium text-t-0 tracking-[0.02em] uppercase">
            Category Breakdown
          </h2>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          {CATEGORIES.map(({ name, agents, share, color }) => (
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

          {/* Rows */}
          {TOP_AGENTS.map((agent) => (
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
                <div className="font-mono text-[13px] text-t-0">$0.001</div>
              </div>
            </div>

            {/* Right: stat cards */}
            <div className="col-span-2 grid grid-cols-2 gap-4">
              <div className="bg-bg-0 border border-border p-4">
                <div className="font-mono text-[9px] text-t-2 tracking-[0.1em] uppercase mb-2">
                  Total Settlements
                </div>
                <div className="font-mono text-[32px] font-medium text-t-0 leading-none">
                  847,302
                </div>
                <div className="font-mono text-[10px] text-t-2 mt-1">all time</div>
              </div>
              <div className="bg-bg-0 border border-border p-4">
                <div className="font-mono text-[9px] text-t-2 tracking-[0.1em] uppercase mb-2">
                  Success Rate
                </div>
                <div className="font-mono text-[32px] font-medium text-accent leading-none">
                  99.97%
                </div>
                <div className="font-mono text-[10px] text-t-2 mt-1">847,047 confirmed</div>
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

    </main>
  );
}
