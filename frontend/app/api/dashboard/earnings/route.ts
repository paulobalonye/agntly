import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const TASK_URL = process.env.TASK_SERVICE_URL ?? 'http://localhost:3004';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('agntly_token')?.value;
  const payload = token ? jwt.decode(token) as { userId: string } | null : null;
  const userId = payload?.userId;

  if (!userId) {
    return NextResponse.json({ success: true, data: [], error: null });
  }

  try {
    // Fetch completed tasks for the last 14 days to build earnings chart
    const res = await fetch(`${TASK_URL}/v1/admin/tasks?limit=500&status=complete`, {
      headers: { 'x-user-id': userId },
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`Task service returned ${res.status}`);

    const json = await res.json();
    const tasks: Record<string, unknown>[] = Array.isArray(json.data) ? json.data : [];

    // Group by day for the last 14 days
    const now = new Date();
    const dayMap = new Map<string, number>();

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dayMap.set(key, 0);
    }

    for (const t of tasks) {
      const ownerId = t.agent_owner_id ?? t.agentOwnerId;
      if (ownerId !== userId) continue;

      const createdAt = new Date(String(t.created_at ?? t.createdAt ?? ''));
      if (isNaN(createdAt.getTime())) continue;

      const key = createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dayMap.has(key)) {
        dayMap.set(key, (dayMap.get(key) ?? 0) + parseFloat(String(t.amount ?? '0')));
      }
    }

    const data = Array.from(dayMap.entries()).map(([day, amount]) => ({ day, amount }));

    return NextResponse.json({ success: true, data, error: null });
  } catch {
    return NextResponse.json({ success: true, data: [], error: null });
  }
}
