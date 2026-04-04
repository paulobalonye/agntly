import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthToken } from '@/lib/get-auth-token';

const AUTH_URL = process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001';
const WALLET_URL = process.env.WALLET_SERVICE_URL ?? 'http://localhost:3002';
const TASK_URL = process.env.TASK_SERVICE_URL ?? 'http://localhost:3004';
const REGISTRY_URL = process.env.REGISTRY_SERVICE_URL ?? 'http://localhost:3005';
const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:3006';

// List of admin emails — in production, this would be a DB role check
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'admin@agntly.io,drpraize@gmail.com,paul.obalonye@gmail.com').split(',');

async function verifyAdmin(): Promise<string | null> {
  const token = await getAuthToken();
  if (!token) return null;

  // Check admin role cookie or known admin emails
  const cookieStore = await cookies();
  const role = cookieStore.get('agntly_role')?.value;
  if (role === 'admin') return token;

  // Also allow known admin emails
  const emailCookie = cookieStore.get('agntly_email')?.value;
  if (emailCookie && ADMIN_EMAILS.includes(emailCookie)) return token;

  return null;
}

async function safeFetch(url: string, token: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return {};
    const json = await res.json();
    return json?.data ?? json ?? {};
  } catch {
    return {};
  }
}

export async function GET() {
  const token = await verifyAdmin();
  if (!token) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  const [userStats, walletStats, taskStats, agentStats, paymentStats, treasuryStats] = await Promise.all([
    safeFetch(`${AUTH_URL}/v1/admin/users/stats`, token),
    safeFetch(`${WALLET_URL}/v1/admin/wallets/stats`, token),
    safeFetch(`${TASK_URL}/v1/admin/tasks/stats`, token),
    safeFetch(`${REGISTRY_URL}/v1/admin/agents/stats`, token),
    safeFetch(`${PAYMENT_URL}/v1/admin/payments/stats`, token),
    safeFetch(`${WALLET_URL}/v1/wallets/treasury`, token),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      users: userStats,
      wallets: walletStats,
      tasks: taskStats,
      agents: agentStats,
      payments: paymentStats,
      treasury: treasuryStats,
    },
    error: null,
  });
}
