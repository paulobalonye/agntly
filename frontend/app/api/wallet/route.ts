import { NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/get-auth-token';

const WALLET_URL = process.env.WALLET_SERVICE_URL ?? 'http://localhost:3002';

export async function GET() {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const res = await fetch(`${WALLET_URL}/v1/wallets`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) {
    return NextResponse.json({ success: true, data: null, error: null });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
