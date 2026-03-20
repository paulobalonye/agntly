interface Task {
  id: string;
  agent: string;
  amount: string;
  status: string;
  timestamp: string;
}

function getStatusPill(status: string): string {
  switch (status) {
    case 'complete':
      return 'bg-accent/10 text-accent border border-accent/25';
    case 'failed':
      return 'bg-red/10 text-red border border-red/25';
    case 'disputed':
      return 'bg-amber/10 text-amber border border-amber/25';
    case 'escrowed':
      return 'bg-blue/10 text-blue border border-blue/25';
    case 'queued':
    default:
      return 'bg-t-2/15 text-t-2 border border-border';
  }
}

interface RecentTasksProps {
  tasks: Task[];
}

export function RecentTasks({ tasks }: RecentTasksProps) {
  return (
    <div className="bg-bg-1 border border-border overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr] bg-bg-2 border-b border-border px-5 py-3">
        {['Task ID', 'Agent', 'Amount', 'Status', 'Time'].map((col) => (
          <div
            key={col}
            className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase"
          >
            {col}
          </div>
        ))}
      </div>

      {/* Rows */}
      {tasks.map((task) => (
        <div
          key={task.id}
          className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr] px-5 py-3 border-b border-border last:border-b-0 hover:bg-bg-2/50 transition-colors items-center"
        >
          {/* Task ID */}
          <div className="font-mono text-[12px] text-t-1 overflow-hidden text-ellipsis whitespace-nowrap">
            {task.id}
          </div>

          {/* Agent */}
          <div className="text-[12px] text-t-0">{task.agent}</div>

          {/* Amount */}
          <div className="font-mono text-[12px] text-accent">${task.amount}</div>

          {/* Status pill */}
          <div>
            <span
              className={`inline-block font-mono text-[10px] px-2 py-[3px] tracking-[0.06em] ${getStatusPill(task.status)}`}
            >
              {task.status}
            </span>
          </div>

          {/* Time */}
          <div className="font-mono text-[11px] text-t-2">{task.timestamp}</div>
        </div>
      ))}

      {tasks.length === 0 && (
        <div className="px-5 py-8 text-center font-mono text-[12px] text-t-2">
          No recent tasks.
        </div>
      )}
    </div>
  );
}
