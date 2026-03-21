'use client';

import { useState, useEffect } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

type TaskStatus = 'complete' | 'failed' | 'escrowed' | 'disputed';

interface ConnectedAgent {
  id: string;
  icon: string;
  name: string;
  calls: number;
  spent: string;
}

interface Task {
  id: string;
  agent: string;
  payload: string;
  status: TaskStatus;
  cost: string;
  time: string;
}

interface SpendingData {
  totalSpent: string;
  tasksToday: string;
  avgCostPerTask: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusPillClasses(status: TaskStatus): string {
  switch (status) {
    case 'complete':
      return 'bg-accent/10 text-accent border border-accent/25';
    case 'failed':
      return 'bg-red/10 text-red border border-red/25';
    case 'escrowed':
      return 'bg-blue/10 text-blue border border-blue/25';
    case 'disputed':
      return 'bg-amber/10 text-amber border border-amber/25';
  }
}

function truncateId(id: string): string {
  if (id.length <= 18) return id;
  return `${id.slice(0, 14)}…`;
}

function truncatePayload(payload: string): string {
  if (payload.length <= 52) return payload;
  return `${payload.slice(0, 52)}…`;
}

function formatCalls(n: number): string {
  return n.toLocaleString('en-US');
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SpendingOverview({ spending }: { spending: SpendingData }) {
  const cards = [
    { label: 'Total Spent', value: spending.totalSpent, unit: 'USDC' },
    { label: 'Tasks Today', value: spending.tasksToday, unit: null },
    { label: 'Avg Cost / Task', value: spending.avgCostPerTask, unit: 'USDC' },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map(({ label, value, unit }) => (
        <div key={label} className="bg-bg-1 border border-border p-5">
          <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-3">
            {label}
          </div>
          <div className="font-mono text-[28px] font-medium text-accent leading-none">
            {value}
            {unit && (
              <span className="text-[13px] text-t-2 ml-2">{unit}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConnectedAgents({ agents }: { agents: ConnectedAgent[] }) {
  return (
    <div className="bg-bg-1 border border-border overflow-hidden">
      <div className="bg-bg-2 border-b border-border px-5 py-3">
        <div className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase">
          Connected Agents
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <div className="font-mono text-[12px] text-t-2">
            No connected agents yet.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-4 p-5 min-w-max">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="bg-bg-2 border border-border p-4 min-w-[180px] flex-shrink-0 hover:border-accent/40 transition-colors"
              >
                <div className="text-[22px] mb-3">{agent.icon}</div>
                <div className="font-mono text-[12px] text-t-0 font-medium mb-3 leading-snug">
                  {agent.name}
                </div>
                <div className="font-mono text-[10px] text-t-2 space-y-1">
                  <div>
                    <span className="text-t-3">calls </span>
                    <span className="text-t-1">{formatCalls(agent.calls)}</span>
                  </div>
                  <div>
                    <span className="text-t-3">spent </span>
                    <span className="text-accent">{agent.spent}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskHistoryTable({ tasks }: { tasks: Task[] }) {
  const columns = ['task id', 'agent', 'payload', 'status', 'cost', 'time'];

  return (
    <div className="bg-bg-1 border border-border overflow-hidden">
      <div className="bg-bg-2 border-b border-border px-5 py-3">
        <div className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase">
          Task History
        </div>
      </div>

      {/* Table header */}
      <div
        className="grid px-5 py-2 border-b border-border bg-bg-2/50"
        style={{ gridTemplateColumns: '160px 140px 1fr 90px 70px 130px' }}
      >
        {columns.map((col) => (
          <div key={col} className="font-mono text-[10px] text-t-2 tracking-[0.06em] uppercase">
            {col}
          </div>
        ))}
      </div>

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="px-5 py-10 text-center">
          <div className="font-mono text-[12px] text-t-2">
            No tasks yet. Hire an agent from the marketplace to get started.
          </div>
        </div>
      )}

      {/* Rows */}
      {tasks.map((task) => (
        <div
          key={task.id}
          className="grid px-5 py-3 border-b border-border last:border-b-0 items-center gap-2 hover:bg-bg-2/40 transition-colors"
          style={{ gridTemplateColumns: '160px 140px 1fr 90px 70px 130px' }}
        >
          {/* Task ID */}
          <div className="font-mono text-[11px] text-t-2 overflow-hidden text-ellipsis whitespace-nowrap">
            {truncateId(task.id)}
          </div>

          {/* Agent */}
          <div className="font-mono text-[11px] text-t-1 overflow-hidden text-ellipsis whitespace-nowrap">
            {task.agent}
          </div>

          {/* Payload */}
          <div className="font-mono text-[10px] text-t-3 overflow-hidden text-ellipsis whitespace-nowrap">
            {truncatePayload(task.payload)}
          </div>

          {/* Status pill */}
          <div>
            <span
              className={`font-mono text-[10px] px-2 py-[2px] tracking-[0.04em] ${statusPillClasses(task.status)}`}
            >
              {task.status}
            </span>
          </div>

          {/* Cost */}
          <div className="font-mono text-[11px] text-t-1">{task.cost}</div>

          {/* Time */}
          <div className="font-mono text-[10px] text-t-3">{task.time}</div>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function normalizeTask(raw: Record<string, unknown>): Task {
  return {
    id: String(raw.id ?? ''),
    agent: String(raw.agent ?? raw.agentName ?? ''),
    payload: String(raw.payload ?? raw.input ?? ''),
    status: (raw.status as TaskStatus) ?? 'complete',
    cost: String(raw.cost ?? raw.price ?? '$0.0000'),
    time: String(raw.time ?? raw.createdAt ?? ''),
  };
}

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<ConnectedAgent[]>([]);
  const [spending, setSpending] = useState<SpendingData>({
    totalSpent: '$0.00',
    tasksToday: '0',
    avgCostPerTask: '$0.0000',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/tasks')
      .then((r) => r.json())
      .then((json) => {
        const list: unknown[] = json?.data ?? json?.tasks ?? json ?? [];
        if (Array.isArray(list)) {
          setTasks(list.map((t) => normalizeTask(t as Record<string, unknown>)));
        }
        if (json?.spending && typeof json.spending === 'object') {
          setSpending({
            totalSpent: String(json.spending.totalSpent ?? '$0.00'),
            tasksToday: String(json.spending.tasksToday ?? '0'),
            avgCostPerTask: String(json.spending.avgCostPerTask ?? '$0.0000'),
          });
        }
        if (Array.isArray(json?.agents)) {
          setAgents(json.agents as ConnectedAgent[]);
        }
      })
      .catch(() => {
        // Keep empty defaults on failure
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="relative z-[1] min-h-[calc(100vh-52px-58px)] px-8 py-8 max-w-[1100px] mx-auto">
      <div className="font-mono text-[10px] text-accent tracking-[0.1em] uppercase mb-1">
        TASK HISTORY
      </div>
      <h1 className="font-display text-[26px] font-semibold text-t-0 mb-8 leading-tight">
        My Tasks
      </h1>

      {loading ? (
        <div className="font-mono text-[12px] text-t-2 text-center py-12">Loading…</div>
      ) : (
        <div className="flex flex-col gap-6">
          <SpendingOverview spending={spending} />
          <ConnectedAgents agents={agents} />
          <TaskHistoryTable tasks={tasks} />
        </div>
      )}
    </div>
  );
}
