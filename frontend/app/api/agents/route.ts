import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('agntly_token')?.value;

  const body = await request.json();

  // Translate frontend field names to registry-service schema:
  // endpointUrl → endpoint, pricePerCall → priceUsdc
  const registryBody = {
    agentId: body.agentId,
    name: body.name,
    description: body.description,
    endpoint: body.endpoint ?? body.endpointUrl,
    priceUsdc: body.priceUsdc ?? body.pricePerCall,
    category: body.category,
    tags: body.tags,
    ...(body.timeoutMs !== undefined ? { timeoutMs: body.timeoutMs } : {}),
  };

  try {
    const res = await fetch(`${REGISTRY_URL}/v1/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(registryBody),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('[api/agents] Failed to POST to registry-service:', err);
    return NextResponse.json(
      { success: false, error: 'Registry service unavailable', data: null },
      { status: 503 },
    );
  }
}
