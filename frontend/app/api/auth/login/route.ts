import { NextRequest, NextResponse } from 'next/server';

const AUTH_URL = process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${AUTH_URL}/v1/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : { success: false, error: 'Empty response from auth service' };
    } catch {
      data = { success: false, error: 'Auth service unavailable' };
    }
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, error: 'Auth service unavailable' }, { status: 503 });
  }
}
