import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const WALLET_URL = process.env.WALLET_SERVICE_URL ?? 'http://localhost:3002';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('agntly_token')?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  const payload = jwt.decode(token) as { userId: string } | null;
  if (!payload?.userId) return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });

  const body = await request.json();
  try {
    const res = await fetch(`${WALLET_URL}/v1/kyc/tier2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': payload.userId },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ success: false, error: 'Service unavailable' }, { status: 503 });
  }
}
