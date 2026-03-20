import { NextRequest, NextResponse } from 'next/server';

const LICENSE_URL = process.env.LICENSE_SERVICE_URL ?? 'http://localhost:3009';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const purchaseCode = body.purchaseCode;

  if (!purchaseCode) {
    return NextResponse.json({ success: false, error: 'Purchase code is required' }, { status: 400 });
  }

  // Derive domain from the request
  const host = request.headers.get('host') ?? 'localhost';
  const domain = host.split(':')[0];

  try {
    const res = await fetch(`${LICENSE_URL}/v1/license/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purchaseCode, domain }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, error: 'License service unavailable' }, { status: 503 });
  }
}
