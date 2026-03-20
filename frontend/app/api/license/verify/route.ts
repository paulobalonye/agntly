import { NextRequest, NextResponse } from 'next/server';

const LICENSE_URL = process.env.LICENSE_SERVICE_URL ?? 'http://localhost:3009';

export async function GET(request: NextRequest) {
  const host = request.headers.get('host') ?? 'localhost';
  const domain = host.split(':')[0];

  try {
    const res = await fetch(`${LICENSE_URL}/v1/license/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    // If license service is down, allow access (graceful degradation)
    return NextResponse.json({ success: true, data: { valid: true, licenseType: 'unchecked' } });
  }
}
