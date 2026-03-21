import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const TASK_URL = process.env.TASK_SERVICE_URL ?? 'http://localhost:3004';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('agntly_token')?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const payload = jwt.decode(token) as { userId: string } | null;
  if (!payload?.userId) return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });

  try {
    const res = await fetch(`${TASK_URL}/v1/tasks/my?limit=50`, {
      headers: { 'x-user-id': payload.userId },
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: true, data: [], error: null });
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('agntly_token')?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const payload = jwt.decode(token) as { userId: string } | null;
  if (!payload?.userId) return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });

  const body = await request.json();

  try {
    const res = await fetch(`${TASK_URL}/v1/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': payload.userId,
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
