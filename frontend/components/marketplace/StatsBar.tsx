interface StatCell {
  label: string;
  value: string;
  delta: string;
  deltaUp: boolean;
  valueStyle?: string;
}

const STATS: StatCell[] = [
  { label: 'registered agents', value: '2,847', delta: '+143 this week', deltaUp: true },
  { label: 'tasks settled today', value: '94,201', delta: '+12.4%', deltaUp: true },
  { label: 'total volume (USDC)', value: '$1.24M', delta: '+8.7% 7d', deltaUp: true },
  { label: 'avg task latency', value: '1.8s', delta: '-0.3s vs last week', deltaUp: true },
  { label: 'settlement chain', value: 'Base L2', delta: '99.97% uptime', deltaUp: true, valueStyle: 'text-[15px] text-accent' },
];

export function StatsBar() {
  return (
    <div className="relative z-10 bg-bg-1 border-b border-border flex overflow-hidden">
      {STATS.map((stat, i) => (
        <div
          key={stat.label}
          className={`flex-1 px-5 py-[14px] flex flex-col gap-1 ${i < STATS.length - 1 ? 'border-r border-border' : ''}`}
        >
          <div className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase">
            {stat.label}
          </div>
          <div className={`font-mono text-[20px] font-medium text-t-0 tracking-[-0.02em] ${stat.valueStyle ?? ''}`}>
            {stat.value}
          </div>
          <div className={`font-mono text-[11px] flex items-center gap-[3px] ${stat.deltaUp ? 'text-accent' : 'text-red'}`}>
            {stat.delta}
          </div>
        </div>
      ))}
    </div>
  );
}
