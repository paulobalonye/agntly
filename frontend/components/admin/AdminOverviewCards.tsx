export interface AdminOverview {
  totalUsers: number;
  usersToday: number;
  totalAgents: number;
  activeAgents: number;
  totalTasks: number;
  tasksToday: number;
  totalVolume: string;
  volumeToday: string;
  totalWallets: number;
  totalBalance: string;
  totalLocked: string;
}

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color: string;
}

function StatCard({ label, value, sub, color }: StatCardProps) {
  return (
    <div className="bg-bg-1 border border-border p-5 flex flex-col gap-2">
      <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase">{label}</div>
      <div className={`font-mono text-[28px] font-medium leading-none ${color}`}>{value}</div>
      {sub && <div className="font-mono text-[11px] text-t-2">{sub}</div>}
    </div>
  );
}

export function AdminOverviewCards({ data }: { data: AdminOverview }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <StatCard
        label="Total Users"
        value={data.totalUsers.toLocaleString()}
        sub={`+${data.usersToday} today`}
        color="text-accent"
      />
      <StatCard
        label="Total Agents"
        value={data.totalAgents.toLocaleString()}
        sub={`${data.activeAgents} active`}
        color="text-blue"
      />
      <StatCard
        label="Total Tasks"
        value={data.totalTasks.toLocaleString()}
        sub={`+${data.tasksToday} today`}
        color="text-amber"
      />
      <StatCard
        label="Total Volume"
        value={`$${data.totalVolume}`}
        sub={`$${data.volumeToday} today`}
        color="text-purple"
      />
    </div>
  );
}
