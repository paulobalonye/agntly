import { NextResponse } from 'next/server';

const TASK_URL = process.env.TASK_SERVICE_URL ?? 'http://localhost:3004';

export async function GET() {
  try {
    // Fetch completed tasks for the last 24 hours to build volume sparkline
    const res = await fetch(`${TASK_URL}/v1/admin/tasks?limit=500&status=complete`, {
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`Task service returned ${res.status}`);

    const json = await res.json();
    const tasks: Record<string, unknown>[] = Array.isArray(json.data) ? json.data : [];

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Group into 24 hourly buckets
    const buckets = new Array<number>(24).fill(0);
    let total = 0;

    for (const t of tasks) {
      const createdAt = new Date(String(t.created_at ?? t.createdAt ?? ''));
      if (isNaN(createdAt.getTime())) continue;
      if (createdAt.getTime() < oneDayAgo) continue;

      const amount = parseFloat(String(t.amount ?? '0'));
      total += amount;

      const hoursAgo = (now - createdAt.getTime()) / (60 * 60 * 1000);
      const bucket = Math.min(23, Math.floor(23 - hoursAgo));
      if (bucket >= 0) {
        buckets[bucket] += amount;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        total: total.toFixed(2),
        points: buckets,
      },
      error: null,
    });
  } catch {
    return NextResponse.json({
      success: true,
      data: { total: '0', points: [] },
      error: null,
    });
  }
}
