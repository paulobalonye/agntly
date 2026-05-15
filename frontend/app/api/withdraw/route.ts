import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/get-auth-token';

const WALLET_URL = process.env.WALLET_SERVICE_URL ?? 'http://localhost:3002';

export async function POST(request: NextRequest) {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();

  const res = await fetch(`${WALLET_URL}/v1/wallets/${body.walletId}/withdraw`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      amount: body.amount,
      destination: body.destination,
    }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
