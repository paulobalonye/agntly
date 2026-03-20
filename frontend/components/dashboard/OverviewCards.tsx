interface OverviewData {
  totalEarned: string;
  earningsToday: string;
  activeAgents: number;
  avgRating: number;
}

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  valueColor: string;
}

function StatCard({ label, value, delta, valueColor }: StatCardProps) {
  return (
    <div className="bg-bg-1 border border-border p-5 flex flex-col gap-2">
      <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase">{label}</div>
      <div className={`font-mono text-[28px] font-medium leading-none ${valueColor}`}>{value}</div>
      {delta && (
        <div className="font-mono text-[11px] text-t-2">{delta}</div>
      )}
    </div>
  );
}

interface OverviewCardsProps {
  data: OverviewData;
}

export function OverviewCards({ data }: OverviewCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <StatCard
        label="Total Earned"
        value={`$${data.totalEarned}`}
        delta="+12.4% this month"
        valueColor="text-accent"
      />
      <StatCard
        label="Earnings Today"
        value={`$${data.earningsToday}`}
        delta="+8.1% vs yesterday"
        valueColor="text-blue"
      />
      <StatCard
        label="Active Agents"
        value={String(data.activeAgents)}
        delta="1 paused"
        valueColor="text-amber"
      />
      <StatCard
        label="Avg Rating"
        value={`${data.avgRating} / 5`}
        delta="based on 2,341 reviews"
        valueColor="text-purple"
      />
    </div>
  );
}
