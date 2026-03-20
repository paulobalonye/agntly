export interface TaskStats {
  totalTasks: number;
  tasksToday: number;
  tasksByStatus: Record<string, number>;
}

const STATUS_COLORS: Record<string, { bar: string; text: string }> = {
  complete: { bar: 'bg-accent', text: 'text-accent' },
  dispatched: { bar: 'bg-blue', text: 'text-blue' },
  escrowed: { bar: 'bg-purple', text: 'text-purple' },
  pending: { bar: 'bg-amber', text: 'text-amber' },
  disputed: { bar: 'bg-red', text: 'text-red' },
  failed: { bar: 'bg-t-2', text: 'text-t-2' },
};

export function TasksBreakdown({ data }: { data: TaskStats }) {
  const total = data.totalTasks || 1; // avoid division by zero

  const entries = Object.entries(data.tasksByStatus).sort(
    ([, a], [, b]) => b - a,
  );

  return (
    <div className="bg-bg-1 border border-border p-5">
      <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-4">
        Tasks by Status
      </div>

      <div className="flex flex-col gap-3">
        {entries.map(([status, count]) => {
          const pct = ((count / total) * 100).toFixed(1);
          const colors = STATUS_COLORS[status] ?? STATUS_COLORS.failed;
          return (
            <div key={status}>
              <div className="flex items-center justify-between mb-1">
                <span className={`font-mono text-[11px] ${colors.text}`}>{status}</span>
                <span className="font-mono text-[11px] text-t-1">
                  {count.toLocaleString()} ({pct}%)
                </span>
              </div>
              <div className="h-[4px] bg-bg-2 overflow-hidden">
                <div
                  className={`h-full ${colors.bar} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
