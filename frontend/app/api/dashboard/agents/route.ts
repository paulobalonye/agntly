import { NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/get-auth-token';

const REGISTRY_URL = process.env.REGISTRY_SERVICE_URL ?? 'http://localhost:3005';

export async function GET() {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ success: true, data: [], error: null });
  }

  try {
    const res = await fetch(`${REGISTRY_URL}/v1/agents`, {
      headers: { 'Authorization': `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`Registry returned ${res.status}`);

    const json = await res.json();
    const agents = Array.isArray(json.data) ? json.data : [];

    // Map to dashboard format
    const mapped = agents.map((a: Record<string, unknown>) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      status: a.status,
      priceUsdc: a.price_usdc ?? a.priceUsdc ?? '0',
      calls24h: a.calls_last_24h ?? a.callsLast24h ?? 0,
      earnings24h: '0.00',
      uptime: parseFloat(String(a.uptime_pct ?? a.uptimePct ?? '100')),
    }));

    return NextResponse.json({ success: true, data: mapped, error: null });
  } catch {
    return NextResponse.json({ success: true, data: [], error: null });
  }
}
