import { NextRequest, NextResponse } from 'next/server';

const REGISTRY_URL = process.env.REGISTRY_SERVICE_URL ?? 'http://localhost:3005';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const res = await fetch(`${REGISTRY_URL}/v1/agents/${encodeURIComponent(id)}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error(`[api/agents/${id}] Failed to fetch from registry-service:`, err);
    return NextResponse.json(
      { success: false, error: 'Registry service unavailable', data: null },
      { status: 503 },
    );
  }
}
