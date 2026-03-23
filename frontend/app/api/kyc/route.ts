import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const WALLET_URL = process.env.WALLET_SERVICE_URL ?? 'http://localhost:3002';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('agntly_token')?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  const payload = jwt.decode(token) as { userId: string } | null;
  if (!payload?.userId) return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });

  try {
    const res = await fetch(`${WALLET_URL}/v1/kyc`, { headers: { 'x-user-id': payload.userId } });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ success: true, data: { tier: 'none', status: 'unverified' } });
  }
}
