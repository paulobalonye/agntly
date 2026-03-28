import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_URL = process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: 'Invalid request body' },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${AUTH_URL}/v1/auth/verify-magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: 'Auth service unavailable' },
      { status: 502 },
    );
  }

  if (!res.ok) {
    let errorData: { error?: string } = {};
    try {
      errorData = await res.json();
    } catch {
      // Auth service returned non-JSON error
    }
    return NextResponse.json(
      { success: false, data: null, error: errorData.error ?? 'Verification failed' },
      { status: res.status },
    );
  }

  let data: { data?: { accessToken?: string; user?: { id: string; email: string; role: string } } };
  try {
    data = await res.json();
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: 'Invalid response from auth service' },
      { status: 502 },
    );
  }

  const accessToken = data.data?.accessToken;
  const user = data.data?.user;

  if (!accessToken || !user) {
    return NextResponse.json(
      { success: false, data: null, error: 'Invalid auth response' },
      { status: 502 },
    );
  }

  // Set httpOnly cookie — auth-service already verified the token
  const cookieStore = await cookies();
  cookieStore.set('agntly_token', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 900,
    path: '/',
  });

  // Set role cookie (readable by client for redirect logic)
  cookieStore.set('agntly_role', user.role, {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    maxAge: 900,
    path: '/',
  });

  // Create a wallet for the user (fire-and-forget; failure must not block login)
  try {
    const walletUrl = process.env.WALLET_SERVICE_URL ?? 'http://localhost:3002';
    await fetch(`${walletUrl}/v1/wallets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user.id,
      },
      body: JSON.stringify({}),
    });
  } catch {
    // Wallet creation failure should not block login
  }

  return NextResponse.json({ success: true, data: { user }, error: null });
}
