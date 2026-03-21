import { NextResponse } from 'next/server';

const REGISTRY_URL = process.env.REGISTRY_SERVICE_URL ?? 'http://localhost:3005';
const TASK_URL = process.env.TASK_SERVICE_URL ?? 'http://localhost:3004';
const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:3006';

// Cache stats for 60 seconds to avoid hammering services
let cache: { data: Record<string, unknown>; expires: number } | null = null;

async function safeFetch(url: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return {};
    const json = await res.json();
    return json?.data ?? json ?? {};
  } catch {
    return {};
  }
}

export async function GET() {
  const now = Date.now();
  if (cache && cache.expires > now) {
    return NextResponse.json({ success: true, data: cache.data, error: null });
  }

  const [agentStats, taskStats, paymentStats] = await Promise.all([
    safeFetch(`${REGISTRY_URL}/v1/admin/agents/stats`),
    safeFetch(`${TASK_URL}/v1/admin/tasks/stats`),
    safeFetch(`${PAYMENT_URL}/v1/admin/payments/stats`),
  ]);

  const totalAgents = Number(agentStats.totalAgents ?? agentStats.total_agents ?? 0);
  const totalTasks = Number(taskStats.totalTasks ?? taskStats.total_tasks ?? 0);
  const tasksToday = Number(taskStats.tasksToday ?? taskStats.tasks_today ?? 0);
  const totalVolume = String(paymentStats.totalVolume ?? paymentStats.total_volume ?? '0');
  const volumeToday = String(paymentStats.volumeToday ?? paymentStats.volume_today ?? '0');

  // Calculate average fee (volume / tasks)
  const vol = parseFloat(totalVolume) || 0;
  const avgFee = totalTasks > 0 ? (vol / totalTasks).toFixed(4) : '0.0000';

  const data = {
    totalAgents,
    totalTasks,
    tasksToday,
    totalVolume,
    volumeToday,
    avgFee,
  };

  cache = { data, expires: now + 60_000 };

  return NextResponse.json({ success: true, data, error: null });
}
