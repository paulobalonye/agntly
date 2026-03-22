import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'admin@agntly.io,drpraize@gmail.com,paul.obalonye@gmail.com').split(',');

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('agntly_token')?.value;
  if (!token) return false;
  const payload = jwt.decode(token) as { email?: string } | null;
  const role = cookieStore.get('agntly_role')?.value;
  if (role === 'admin') return true;
  if (payload?.email && ADMIN_EMAILS.includes(payload.email)) return true;
  return false;
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ ok: false, error: 'Admin access required' }, { status: 403 });
  }

  const port = request.nextUrl.searchParams.get('port');
  if (!port) {
    return NextResponse.json({ ok: false, error: 'port required' });
  }

  // Only allow probing known service ports
  const allowedPorts = ['3000', '3001', '3002', '3003', '3004', '3005', '3006', '3007', '3008', '4000'];
  if (!allowedPorts.includes(port)) {
    return NextResponse.json({ ok: false, error: 'Invalid port' });
  }

  try {
    const res = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return NextResponse.json({ ok: res.ok });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
