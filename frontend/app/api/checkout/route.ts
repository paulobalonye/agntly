import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/get-auth-token';

const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:3006';

export async function POST(request: NextRequest) {
  const token = await getAuthToken();
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();

  const res = await fetch(`${PAYMENT_URL}/v1/payments/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      walletId: body.walletId,
      amountUsd: body.amountUsd,
      method: body.method ?? 'card',
    }),
  });

  const data = await res.json();

  // If checkout URL is returned, redirect the user to Stripe
  if (data.success && data.data?.checkoutUrl) {
    return NextResponse.json({ success: true, data: { checkoutUrl: data.data.checkoutUrl } });
  }

  return NextResponse.json(data, { status: res.status });
}
