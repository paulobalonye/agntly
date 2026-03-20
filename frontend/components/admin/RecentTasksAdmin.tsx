export interface AdminTask {
  id: string;
  agentId: string | null;
  callerId: string | null;
  status: string;
  priceUsdc: string | null;
  createdAt: string;
}

function statusPill(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-accent/10 text-accent border border-accent/25';
    case 'active':
      return 'bg-blue/10 text-blue border border-blue/25';
    case 'pending':
      return 'bg-amber/10 text-amber border border-amber/25';
    case 'disputed':
      return 'bg-red/10 text-red border border-red/25';
    default:
      return 'bg-t-2/15 text-t-2 border border-border';
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function truncate(s: string | null, len = 12): string {
  if (!s) return '—';
  if (s.length <= len) return s;
  return s.slice(0, len) + '...';
}

export function RecentTasksAdmin({ tasks }: { tasks: AdminTask[] }) {
  return (
    <div className="bg-bg-1 border border-border overflow-hidden">
      <div
        className="grid bg-bg-2 border-b border-border px-5 py-3"
        style={{ gridTemplateColumns: '2fr 1.5fr 1.5fr 80px 90px 120px' }}
      >
        {['Task ID', 'Agent', 'Caller', 'Status', 'Price', 'Created'].map((col) => (
          <div
            key={col}
            className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase"
          >
            {col}
          </div>
        ))}
      </div>

      {tasks.map((task) => (
        <div
          key={task.id}
          className="grid px-5 py-3 border-b border-border last:border-b-0 items-center hover:bg-bg-2/50 transition-colors"
          style={{ gridTemplateColumns: '2fr 1.5fr 1.5fr 80px 90px 120px' }}
        >
          <div className="font-mono text-[11px] text-t-1 overflow-hidden text-ellipsis whitespace-nowrap">
            {truncate(task.id, 16)}
          </div>
          <div className="font-mono text-[11px] text-t-2 overflow-hidden text-ellipsis whitespace-nowrap">
            {truncate(task.agentId)}
          </div>
          <div className="font-mono text-[11px] text-t-2 overflow-hidden text-ellipsis whitespace-nowrap">
            {truncate(task.callerId)}
          </div>
          <div>
            <span className={`inline-block font-mono text-[10px] px-2 py-[2px] ${statusPill(task.status)}`}>
              {task.status}
            </span>
          </div>
          <div className="font-mono text-[12px] text-accent">
            {task.priceUsdc ? `$${task.priceUsdc}` : '—'}
          </div>
          <div className="font-mono text-[10px] text-t-2">{formatTime(task.createdAt)}</div>
        </div>
      ))}

      {tasks.length === 0 && (
        <div className="px-5 py-8 text-center font-mono text-[12px] text-t-2">
          No tasks found.
        </div>
      )}
    </div>
  );
}
