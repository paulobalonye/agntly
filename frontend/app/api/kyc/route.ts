import { NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/get-auth-token';

const WALLET_URL = process.env.WALLET_SERVICE_URL ?? 'http://localhost:3002';

export async function GET() {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  try {
    const res = await fetch(`${WALLET_URL}/v1/kyc`, { headers: { 'Authorization': `Bearer ${token}` } });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ success: true, data: { tier: 'none', status: 'unverified' } });
  }
}
