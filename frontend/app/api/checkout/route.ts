import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:3006';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('agntly_token')?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });

  const payload = jwt.decode(token) as { userId: string } | null;
  if (!payload?.userId) return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });

  const body = await request.json();

  const res = await fetch(`${PAYMENT_URL}/v1/payments/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-user-id': payload.userId,
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
