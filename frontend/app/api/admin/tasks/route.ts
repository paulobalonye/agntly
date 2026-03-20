import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const TASK_URL = process.env.TASK_SERVICE_URL ?? 'http://localhost:3004';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'admin@agntly.io,drpraize@gmail.com,paul.obalonye@gmail.com').split(',');

async function verifyAdmin(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('agntly_token')?.value;
  if (!token) return null;
  const payload = jwt.decode(token) as { userId: string; email?: string } | null;
  if (!payload?.userId) return null;
  const role = cookieStore.get('agntly_role')?.value;
  if (role === 'admin') return payload;
  if (payload.email && ADMIN_EMAILS.includes(payload.email)) return payload;
  return null;
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  const limit = request.nextUrl.searchParams.get('limit') ?? '20';
  const offset = request.nextUrl.searchParams.get('offset') ?? '0';

  try {
    const res = await fetch(
      `${TASK_URL}/v1/admin/tasks?limit=${limit}&offset=${offset}`,
      { headers: { 'x-user-id': admin.userId } },
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: true, data: [], error: null });
  }
}
