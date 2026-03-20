import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_URL = process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const res = await fetch(`${AUTH_URL}/v1/auth/verify-magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  const data = await res.json();
  const { accessToken, user } = data.data;

  // Set httpOnly cookie — auth-service already verified the token
  const cookieStore = await cookies();
  cookieStore.set('agntly_token', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 900,
    path: '/',
  });

  return NextResponse.json({ success: true, data: { user }, error: null });
}
