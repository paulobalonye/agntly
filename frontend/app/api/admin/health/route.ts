import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const port = request.nextUrl.searchParams.get('port');
  if (!port) {
    return NextResponse.json({ ok: false, error: 'port required' });
  }

  try {
    const res = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    const ok = res.ok;
    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
