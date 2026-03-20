'use client';

import { useState, useEffect } from 'react';
import { RecentTasksAdmin, type AdminTask } from '@/components/admin/RecentTasksAdmin';
import { TasksBreakdown, type TaskStats } from '@/components/admin/TasksBreakdown';

export default function AdminTransactionsPage() {
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats>({
    totalTasks: 0, tasksToday: 0,
    tasksByStatus: { pending: 0, escrowed: 0, dispatched: 0, complete: 0, disputed: 0, failed: 0 },
  });
  const [paymentStats, setPaymentStats] = useState({
    totalPayments: 0, totalVolume: '0', paymentsToday: 0, volumeToday: '0',
  });
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const limit = 30;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/tasks?limit=${limit}&offset=${offset}`).then((r) => r.json()),
      fetch('/api/admin/stats').then((r) => r.json()),
    ])
      .then(([tasksJson, statsJson]) => {
        if (tasksJson.success && Array.isArray(tasksJson.data)) {
          setTasks(
            tasksJson.data.map((t: Record<string, unknown>) => ({
              id: String(t.id ?? ''),
              agentId: t.agent_id ?? t.agentId ? String(t.agent_id ?? t.agentId) : null,
              callerId: t.orchestrator_id ?? t.orchestratorId ? String(t.orchestrator_id ?? t.orchestratorId) : null,
              status: String(t.status ?? 'unknown'),
              priceUsdc: t.amount ? String(t.amount) : null,
              createdAt: String(t.created_at ?? t.createdAt ?? ''),
            })),
          );
          setTotal(tasksJson.meta?.total ?? tasksJson.data.length);
        }
        if (statsJson?.data) {
          if (statsJson.data.tasks) {
            setTaskStats({
              totalTasks: statsJson.data.tasks.totalTasks ?? 0,
              tasksToday: statsJson.data.tasks.tasksToday ?? 0,
              tasksByStatus: statsJson.data.tasks.tasksByStatus ?? {},
            });
          }
          if (statsJson.data.payments) {
            setPaymentStats(statsJson.data.payments);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [offset]);

  return (
    <main className="relative z-10 min-h-screen px-8 py-8 max-w-[1400px] mx-auto">
      <div className="mb-8">
        <div className="font-mono text-[11px] text-red tracking-[0.1em] uppercase mb-2">admin</div>
        <h1 className="font-display text-[32px] font-semibold text-t-0 leading-tight">Transactions</h1>
        <p className="font-mono text-[12px] text-t-2 mt-1">Tasks, payments, and escrow activity</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 justify-center">
          <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          <span className="font-mono text-[12px] text-t-2">Loading transactions...</span>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3 mb-8">
            <div className="bg-bg-1 border border-border p-5">
              <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase">Total Tasks</div>
              <div className="font-mono text-[28px] font-medium text-accent leading-none mt-2">
                {taskStats.totalTasks.toLocaleString()}
              </div>
              <div className="font-mono text-[11px] text-t-2 mt-1">+{taskStats.tasksToday} today</div>
            </div>
            <div className="bg-bg-1 border border-border p-5">
              <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase">Total Payments</div>
              <div className="font-mono text-[28px] font-medium text-blue leading-none mt-2">
                {paymentStats.totalPayments.toLocaleString()}
              </div>
              <div className="font-mono text-[11px] text-t-2 mt-1">+{paymentStats.paymentsToday} today</div>
            </div>
            <div className="bg-bg-1 border border-border p-5">
              <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase">Total Volume</div>
              <div className="font-mono text-[28px] font-medium text-accent leading-none mt-2">
                ${paymentStats.totalVolume}
              </div>
              <div className="font-mono text-[11px] text-t-2 mt-1">${paymentStats.volumeToday} today</div>
            </div>
            <div className="bg-bg-1 border border-border p-5">
              <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase">Disputed</div>
              <div className="font-mono text-[28px] font-medium text-red leading-none mt-2">
                {taskStats.tasksByStatus.disputed ?? 0}
              </div>
              <div className="font-mono text-[11px] text-t-2 mt-1">require attention</div>
            </div>
          </div>

          {/* Task distribution */}
          <section className="mb-8">
            <h2 className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase pb-3 border-b border-border mb-4">
              Task Distribution
            </h2>
            <TasksBreakdown data={taskStats} />
          </section>

          {/* Task list */}
          <section className="mb-8">
            <h2 className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase pb-3 border-b border-border mb-4">
              Recent Tasks
            </h2>
            <RecentTasksAdmin tasks={tasks} />

            {total > limit && (
              <div className="flex items-center justify-between mt-4">
                <div className="font-mono text-[11px] text-t-2">
                  Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                    className="font-mono text-[11px] px-3 py-1 border border-border text-t-1 hover:border-accent hover:text-accent transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    prev
                  </button>
                  <button
                    onClick={() => setOffset(offset + limit)}
                    disabled={offset + limit >= total}
                    className="font-mono text-[11px] px-3 py-1 border border-border text-t-1 hover:border-accent hover:text-accent transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    next
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
