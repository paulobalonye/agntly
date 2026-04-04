import { NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/get-auth-token';

const TASK_URL = process.env.TASK_SERVICE_URL ?? 'http://localhost:3004';

export async function GET() {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ success: true, data: [], error: null });
  }

  try {
    // Fetch recent tasks for this user (as orchestrator)
    const res = await fetch(`${TASK_URL}/v1/admin/tasks?limit=10`, {
      headers: { 'Authorization': `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`Task service returned ${res.status}`);

    const json = await res.json();
    const tasks = Array.isArray(json.data) ? json.data : [];

    // Map to dashboard format
    const mapped = tasks
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
