import { NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/get-auth-token';

const REGISTRY_URL = process.env.REGISTRY_SERVICE_URL ?? 'http://localhost:3005';
const WALLET_URL = process.env.WALLET_SERVICE_URL ?? 'http://localhost:3002';

export async function GET() {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ success: true, data: { totalEarned: '0', earningsToday: '0', activeAgents: 0, avgRating: 0 }, error: null });
  }

  try {
    // Fetch user's agents from registry
    const agentsRes = await fetch(`${REGISTRY_URL}/v1/agents`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const agentsJson = await agentsRes.json();
    const agents = Array.isArray(agentsJson?.data) ? agentsJson.data : [];

    const activeAgents = agents.filter((a: Record<string, unknown>) => a.status === 'active').length;
    const totalEarned = agents.reduce((sum: number, a: Record<string, unknown>) => sum + parseFloat(String(a.total_earned ?? a.totalEarned ?? '0')), 0);
    const avgRating = agents.length > 0
      ? agents.reduce((sum: number, a: Record<string, unknown>) => sum + parseFloat(String(a.reputation ?? '0')), 0) / agents.length
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalEarned: totalEarned.toFixed(2),
        earningsToday: '0.00',
        activeAgents,
        avgRating: parseFloat(avgRating.toFixed(2)),
      },
      error: null,
    });
  } catch {
    return NextResponse.json({ success: true, data: { totalEarned: '0', earningsToday: '0', activeAgents: 0, avgRating: 0 }, error: null });
  }
}
