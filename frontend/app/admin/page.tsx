'use client';

import { useState, useEffect } from 'react';
import { AdminOverviewCards, type AdminOverview } from '@/components/admin/AdminOverviewCards';
import { PlatformHealth } from '@/components/admin/PlatformHealth';
import { UsersTable, type AdminUser } from '@/components/admin/UsersTable';
import { TasksBreakdown, type TaskStats } from '@/components/admin/TasksBreakdown';
import { TreasuryOverview, type TreasuryData } from '@/components/admin/TreasuryOverview';
import { RecentTasksAdmin, type AdminTask } from '@/components/admin/RecentTasksAdmin';

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase pb-3 border-b border-border mb-4">
      {children}
    </h2>
  );
}

const OVERVIEW_FALLBACK: AdminOverview = {
  totalUsers: 0,
  usersToday: 0,
  totalAgents: 0,
  activeAgents: 0,
  totalTasks: 0,
  tasksToday: 0,
  totalVolume: '0.00',
  volumeToday: '0.00',
  totalWallets: 0,
  totalBalance: '0.00',
  totalLocked: '0.00',
};

const TASK_STATS_FALLBACK: TaskStats = {
  totalTasks: 0,
  tasksToday: 0,
  tasksByStatus: { pending: 0, escrowed: 0, dispatched: 0, complete: 0, disputed: 0, failed: 0 },
};

const TREASURY_FALLBACK: TreasuryData = {
  totalWallets: 0,
  totalBalance: '0.00',
  totalLocked: '0.00',
};

export default function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview>(OVERVIEW_FALLBACK);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats>(TASK_STATS_FALLBACK);
  const [treasury, setTreasury] = useState<TreasuryData>(TREASURY_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [statsRes, usersRes, tasksRes] = await Promise.all([
          fetch('/api/admin/stats'),
          fetch('/api/admin/users?limit=20'),
          fetch('/api/admin/tasks?limit=20'),
        ]);

        if (statsRes.status === 403) {
          setError('Admin access required. Set your role to admin to access this page.');
          setLoading(false);
          return;
        }

        const statsJson = await statsRes.json();
        const usersJson = await usersRes.json();
        const tasksJson = await tasksRes.json();

        if (statsJson.success && statsJson.data) {
          const d = statsJson.data;
          setOverview({
            totalUsers: d.users?.totalUsers ?? 0,
            usersToday: d.users?.usersToday ?? 0,
            totalAgents: d.agents?.totalAgents ?? 0,
            activeAgents: d.agents?.activeAgents ?? 0,
            totalTasks: d.tasks?.totalTasks ?? 0,
            tasksToday: d.tasks?.tasksToday ?? 0,
            totalVolume: d.payments?.totalVolume ?? '0.00',
            volumeToday: d.payments?.volumeToday ?? '0.00',
            totalWallets: d.wallets?.totalWallets ?? 0,
            totalBalance: d.wallets?.totalBalance ?? '0.00',
            totalLocked: d.wallets?.totalLocked ?? '0.00',
          });
          setTaskStats({
            totalTasks: d.tasks?.totalTasks ?? 0,
            tasksToday: d.tasks?.tasksToday ?? 0,
            tasksByStatus: d.tasks?.tasksByStatus ?? TASK_STATS_FALLBACK.tasksByStatus,
          });
          setTreasury({
            totalWallets: d.wallets?.totalWallets ?? 0,
            totalBalance: d.wallets?.totalBalance ?? '0.00',
            totalLocked: d.wallets?.totalLocked ?? '0.00',
            platformRevenue: d.treasury?.balance ?? '0.00',
          });
        }

        if (usersJson.success && Array.isArray(usersJson.data)) {
          setUsers(
            usersJson.data.map((u: Record<string, unknown>) => ({
              id: String(u.id ?? ''),
              email: String(u.email ?? ''),
              role: u.role ? String(u.role) : null,
              createdAt: String(u.createdAt ?? u.created_at ?? ''),
            })),
          );
        }

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
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load admin data');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (error) {
    return (
      <main className="relative z-10 min-h-screen px-8 py-8 max-w-[1400px] mx-auto">
        <div className="bg-red/10 border border-red/25 p-6 mt-8">
          <div className="font-mono text-[13px] text-red">{error}</div>
          <div className="font-mono text-[11px] text-t-2 mt-2">
            To access the admin dashboard, set the <code className="text-t-1">agntly_role</code> cookie
            to <code className="text-accent">admin</code>.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative z-10 min-h-screen px-8 py-8 max-w-[1400px] mx-auto">
      {/* Page heading */}
      <div className="mb-8">
        <div className="font-mono text-[11px] text-red tracking-[0.1em] uppercase mb-2">
          platform admin
        </div>
        <h1 className="font-display text-[32px] font-semibold text-t-0 leading-tight">
          Admin Dashboard
        </h1>
        <p className="font-mono text-[12px] text-t-2 mt-1">
          Platform-wide monitoring and management
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 justify-center">
          <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          <span className="font-mono text-[12px] text-t-2">Loading platform data...</span>
        </div>
      ) : (
        <>
          {/* Overview cards */}
          <section className="mb-8">
            <SectionHeading>Platform Overview</SectionHeading>
            <AdminOverviewCards data={overview} />
          </section>

          {/* Service health + Treasury side by side */}
          <section className="mb-8">
            <SectionHeading>Infrastructure &amp; Treasury</SectionHeading>
            <div className="grid grid-cols-[2fr_1fr] gap-4 items-start">
              <PlatformHealth />
              <TreasuryOverview data={treasury} />
            </div>
          </section>

          {/* Tasks breakdown */}
          <section className="mb-8">
            <SectionHeading>Task Distribution</SectionHeading>
            <TasksBreakdown data={taskStats} />
          </section>

          {/* Recent tasks */}
          <section className="mb-8">
            <SectionHeading>Recent Tasks</SectionHeading>
            <RecentTasksAdmin tasks={tasks} />
          </section>

          {/* Users table */}
          <section className="mb-8">
            <SectionHeading>Recent Users</SectionHeading>
            <UsersTable users={users} />
          </section>
        </>
      )}
    </main>
  );
}
