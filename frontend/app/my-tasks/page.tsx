'use client';

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

// ── Demo data ─────────────────────────────────────────────────────────────────

const SPENDING_OVERVIEW = {
  totalSpent: '$847.20',
  tasksToday: '1,247',
  avgCostPerTask: '$0.0028',
} as const;

const CONNECTED_AGENTS: ConnectedAgent[] = [
  { id: 'a1', icon: '🔍', name: 'WebSearch Alpha',  calls: 3421, spent: '$6.84' },
  { id: 'a2', icon: '📄', name: 'PDFParser NX',     calls: 1208, spent: '$1.21' },
  { id: 'a3', icon: '⚙️', name: 'CodeExec Pro',     calls: 847,  spent: '$4.24' },
  { id: 'a4', icon: '📊', name: 'DataWrangler v2',  calls: 312,  spent: '$0.94' },
];

const DEMO_TASKS: Task[] = [
  {
    id: 'tsk_4f3c8a1b2e9d',
    agent: 'WebSearch Alpha',
    payload: '{"query":"latest AI model benchmarks 2026","depth":3}',
    status: 'complete',
    cost: '$0.0028',
    time: '2026-03-20 14:47',
  },
  {
    id: 'tsk_7a8bf9e02c1d',
    agent: 'PDFParser NX',
    payload: '{"url":"https://arxiv.org/pdf/2403.1234.pdf","pages":"all"}',
    status: 'complete',
    cost: '$0.0010',
    time: '2026-03-20 14:31',
  },
  {
    id: 'tsk_1c2d3e4f5a6b',
    agent: 'CodeExec Pro',
    payload: '{"lang":"python","code":"import pandas as pd; df = pd.read_csv..."}',
    status: 'complete',
    cost: '$0.0050',
    time: '2026-03-20 13:58',
  },
  {
    id: 'tsk_9b0a7c6d5e4f',
    agent: 'DataWrangler v2',
    payload: '{"source":"s3://bucket/sales-q1.csv","transform":"pivot"}',
    status: 'failed',
    cost: '$0.0003',
    time: '2026-03-20 13:22',
  },
  {
    id: 'tsk_2e3f4a5b6c7d',
    agent: 'WebSearch Alpha',
    payload: '{"query":"USDC stablecoin market cap April 2026"}',
    status: 'complete',
    cost: '$0.0028',
    time: '2026-03-20 12:49',
  },
  {
    id: 'tsk_8d9e0f1a2b3c',
    agent: 'CodeExec Pro',
    payload: '{"lang":"js","code":"const res = await fetch(url); return res.json()"}',
    status: 'escrowed',
    cost: '$0.0050',
    time: '2026-03-20 12:15',
  },
  {
    id: 'tsk_5a6b7c8d9e0f',
    agent: 'PDFParser NX',
    payload: '{"url":"https://company.io/report-2026.pdf","extract":"tables"}',
    status: 'complete',
    cost: '$0.0010',
    time: '2026-03-20 11:43',
  },
  {
    id: 'tsk_3c4d5e6f7a8b',
    agent: 'WebSearch Alpha',
    payload: '{"query":"on-chain agent marketplace competitors","max_results":10}',
    status: 'complete',
    cost: '$0.0028',
    time: '2026-03-20 11:07',
  },
  {
    id: 'tsk_0f1a2b3c4d5e',
    agent: 'DataWrangler v2',
    payload: '{"source":"postgres://db/transactions","group_by":"agent_id"}',
    status: 'disputed',
    cost: '$0.0030',
    time: '2026-03-20 10:34',
  },
  {
    id: 'tsk_6b7c8d9e0f1a',
    agent: 'CodeExec Pro',
    payload: '{"lang":"python","code":"import sklearn; model = LinearRegression()"}',
    status: 'complete',
    cost: '$0.0050',
    time: '2026-03-20 10:02',
  },
  {
    id: 'tsk_4e5f6a7b8c9d',
    agent: 'WebSearch Alpha',
    payload: '{"query":"LLM inference cost reduction techniques 2026"}',
    status: 'complete',
    cost: '$0.0028',
    time: '2026-03-20 09:18',
  },
  {
    id: 'tsk_2a3b4c5d6e7f',
    agent: 'PDFParser NX',
    payload: '{"url":"https://example.org/whitepaper.pdf","pages":"1-5"}',
    status: 'failed',
    cost: '$0.0010',
    time: '2026-03-20 08:55',
  },
  {
    id: 'tsk_8c9d0e1f2a3b',
    agent: 'DataWrangler v2',
    payload: '{"source":"s3://bucket/events.jsonl","output":"parquet"}',
    status: 'complete',
    cost: '$0.0030',
    time: '2026-03-20 08:22',
  },
  {
    id: 'tsk_7f8a9b0c1d2e',
    agent: 'WebSearch Alpha',
    payload: '{"query":"solidity gas optimization patterns","depth":2}',
    status: 'complete',
    cost: '$0.0028',
    time: '2026-03-20 07:41',
  },
  {
    id: 'tsk_5d6e7f8a9b0c',
    agent: 'CodeExec Pro',
    payload: '{"lang":"bash","code":"jq \'.[] | select(.status==\\\"complete\\\")\' tasks.json"}',
    status: 'escrowed',
    cost: '$0.0050',
    time: '2026-03-20 07:05',
  },
];

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

function SpendingOverview() {
  const cards = [
    { label: 'Total Spent', value: SPENDING_OVERVIEW.totalSpent, unit: 'USDC' },
    { label: 'Tasks Today', value: SPENDING_OVERVIEW.tasksToday, unit: null },
    { label: 'Avg Cost / Task', value: SPENDING_OVERVIEW.avgCostPerTask, unit: 'USDC' },
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

function ConnectedAgents() {
  return (
    <div className="bg-bg-1 border border-border overflow-hidden">
      <div className="bg-bg-2 border-b border-border px-5 py-3">
        <div className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase">
          Connected Agents
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-4 p-5 min-w-max">
          {CONNECTED_AGENTS.map((agent) => (
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
    </div>
  );
}

function TaskHistoryTable() {
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

      {/* Rows */}
      {DEMO_TASKS.map((task) => (
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

export default function MyTasksPage() {
  return (
    <div className="relative z-[1] min-h-[calc(100vh-52px-58px)] px-8 py-8 max-w-[1100px] mx-auto">
      <div className="font-mono text-[10px] text-accent tracking-[0.1em] uppercase mb-1">
        TASK HISTORY
      </div>
      <h1 className="font-display text-[26px] font-semibold text-t-0 mb-8 leading-tight">
        My Tasks
      </h1>

      <div className="flex flex-col gap-6">
        <SpendingOverview />
        <ConnectedAgents />
        <TaskHistoryTable />
      </div>
    </div>
  );
}
