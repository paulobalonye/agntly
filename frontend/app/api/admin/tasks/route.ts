import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthToken } from '@/lib/get-auth-token';

const TASK_URL = process.env.TASK_SERVICE_URL ?? 'http://localhost:3004';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'admin@agntly.io,drpraize@gmail.com,paul.obalonye@gmail.com').split(',');

async function verifyAdmin(): Promise<string | null> {
  const token = await getAuthToken();
  if (!token) return null;
  const cookieStore = await cookies();
  const role = cookieStore.get('agntly_role')?.value;
  if (role === 'admin') return token;
  const emailCookie = cookieStore.get('agntly_email')?.value;
  if (emailCookie && ADMIN_EMAILS.includes(emailCookie)) return token;
  return null;
}

export async function GET(request: NextRequest) {
  const token = await verifyAdmin();
  if (!token) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  const limit = request.nextUrl.searchParams.get('limit') ?? '20';
  const offset = request.nextUrl.searchParams.get('offset') ?? '0';

  try {
    const res = await fetch(
      `${TASK_URL}/v1/admin/tasks?limit=${limit}&offset=${offset}`,
      { headers: { 'Authorization': `Bearer ${token}` } },
    );
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: true, data: [], error: null });
  }
}
