import { NextRequest, NextResponse } from 'next/server';

const REGISTRY_URL = process.env.REGISTRY_SERVICE_URL ?? 'http://localhost:3005';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${REGISTRY_URL}/v1/agents${searchParams ? '?' + searchParams : ''}`;

  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('[api/agents] Failed to fetch from registry-service:', err);
    return NextResponse.json(
      { success: false, error: 'Registry service unavailable', data: null },
      { status: 503 },
    );
  }
}
