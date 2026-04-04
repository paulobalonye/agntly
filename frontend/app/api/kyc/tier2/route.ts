import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/get-auth-token';

const WALLET_URL = process.env.WALLET_SERVICE_URL ?? 'http://localhost:3002';

export async function POST(request: NextRequest) {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();
  try {
    const res = await fetch(`${WALLET_URL}/v1/kyc/tier2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ success: false, error: 'Service unavailable' }, { status: 503 });
  }
}
