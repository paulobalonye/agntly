import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const AUTH_URL = process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('agntly_token')?.value;
  if (!token) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const payload = jwt.decode(token) as { userId: string } | null;
  if (!payload?.userId) {
    return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
  }

  const body = await request.json();

  const res = await fetch(`${AUTH_URL}/v1/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ label: body.label ?? 'default', userId: payload.userId }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('agntly_token')?.value;
  if (!token) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const res = await fetch(`${AUTH_URL}/v1/api-keys`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
