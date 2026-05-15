import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/get-auth-token';

const TASK_URL = process.env.TASK_SERVICE_URL ?? 'http://localhost:3004';

export async function GET() {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  try {
    const res = await fetch(`${TASK_URL}/v1/tasks/my?limit=50`, {
      headers: { 'Authorization': `Bearer ${token}` },
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: true, data: [], error: null });
  }
}

export async function POST(request: NextRequest) {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();

  try {
    const res = await fetch(`${TASK_URL}/v1/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        agentId: body.agentId,
        payload: body.payload ?? {},
        budget: body.budget,
        timeoutMs: body.timeoutMs,
        dispatch: body.dispatch ?? true,
      }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, error: 'Task service unavailable' }, { status: 503 });
  }
}
