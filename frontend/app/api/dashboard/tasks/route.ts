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
    // Fetch recent tasks for this user (as orchestrator)
    const res = await fetch(`${TASK_URL}/v1/admin/tasks?limit=10`, {
      headers: { 'x-user-id': userId },
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`Task service returned ${res.status}`);

    const json = await res.json();
    const tasks = Array.isArray(json.data) ? json.data : [];

    // Map to dashboard format
    const mapped = tasks
      .filter((t: Record<string, unknown>) =>
        t.orchestrator_id === userId || t.orchestratorId === userId
      )
      .map((t: Record<string, unknown>) => ({
        id: String(t.id ?? ''),
        agent: String(t.agent_id ?? t.agentId ?? ''),
        amount: String(t.amount ?? '0'),
        status: String(t.status ?? 'unknown'),
        timestamp: t.created_at ?? t.createdAt ?? '',
      }));

    return NextResponse.json({ success: true, data: mapped, error: null });
  } catch {
    return NextResponse.json({ success: true, data: [], error: null });
  }
}
