import { NextResponse } from 'next/server';

const REGISTRY_URL = process.env.REGISTRY_SERVICE_URL ?? 'http://localhost:3001';

const FALLBACK_AGENTS = [
  {
    id: 'ag_websearch_pro',
    name: 'WebSearch Pro',
    category: 'search',
    status: 'active',
    priceUsdc: '0.085',
    calls24h: 1248,
    earnings24h: '106.08',
    uptime: 99.7,
  },
  {
    id: 'ag_codeexec_engine',
    name: 'CodeExec Engine',
    category: 'code',
    status: 'active',
    priceUsdc: '0.150',
    calls24h: 623,
    earnings24h: '93.45',
    uptime: 98.2,
  },
  {
    id: 'ag_dataworker',
    name: 'DataWorker',
    category: 'data',
    status: 'active',
    priceUsdc: '0.200',
    calls24h: 411,
    earnings24h: '82.20',
    uptime: 99.1,
  },
  {
    id: 'ag_pipeline_proc',
    name: 'Pipeline Processor',
    category: 'file',
    status: 'paused',
    priceUsdc: '0.120',
    calls24h: 0,
    earnings24h: '0.00',
    uptime: 97.5,
  },
];

export async function GET() {
  try {
    const res = await fetch(`${REGISTRY_URL}/v1/agents`, {
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      throw new Error(`Registry service returned ${res.status}`);
    }

    const json = await res.json();
    const agents = Array.isArray(json.data) ? json.data : json;

    return NextResponse.json({ success: true, data: agents, error: null });
  } catch {
    // Return fallback data when the registry service is unavailable
    return NextResponse.json({ success: true, data: FALLBACK_AGENTS, error: null });
  }
}
