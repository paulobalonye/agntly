import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const LICENSE_URL = process.env.LICENSE_SERVICE_URL ?? 'http://localhost:3009';
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
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  const limit = request.nextUrl.searchParams.get('limit') ?? '50';
  const offset = request.nextUrl.searchParams.get('offset') ?? '0';

  try {
    const res = await fetch(`${LICENSE_URL}/v1/license/admin/list?limit=${limit}&offset=${offset}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: true, data: [], error: null, meta: { total: 0 } });
  }
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const action = body.action;

  if (action === 'revoke') {
    const res = await fetch(`${LICENSE_URL}/v1/license/admin/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purchaseCode: body.purchaseCode }),
    });
    const data = await res.json();
    return NextResponse.json(data);
  }

  return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
}
