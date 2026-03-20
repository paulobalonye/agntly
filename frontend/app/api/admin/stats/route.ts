import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const AUTH_URL = process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001';
const WALLET_URL = process.env.WALLET_SERVICE_URL ?? 'http://localhost:3002';
const TASK_URL = process.env.TASK_SERVICE_URL ?? 'http://localhost:3004';
const REGISTRY_URL = process.env.REGISTRY_SERVICE_URL ?? 'http://localhost:3005';
const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:3006';

// List of admin emails — in production, this would be a DB role check
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'admin@agntly.io,drpraize@gmail.com,paul.obalonye@gmail.com').split(',');

async function verifyAdmin(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('agntly_token')?.value;
  if (!token) return null;

  const payload = jwt.decode(token) as { userId: string; email?: string } | null;
  if (!payload?.userId) return null;

  // Check admin role cookie or known admin emails
  const role = cookieStore.get('agntly_role')?.value;
  if (role === 'admin') return payload;

  // Also allow known admin emails
  if (payload.email && ADMIN_EMAILS.includes(payload.email)) return payload;

  return null;
}

async function safeFetch(url: string, userId: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(url, {
      headers: { 'x-user-id': userId },
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
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  const [userStats, walletStats, taskStats, agentStats, paymentStats] = await Promise.all([
    safeFetch(`${AUTH_URL}/v1/admin/users/stats`, admin.userId),
    safeFetch(`${WALLET_URL}/v1/admin/wallets/stats`, admin.userId),
    safeFetch(`${TASK_URL}/v1/admin/tasks/stats`, admin.userId),
    safeFetch(`${REGISTRY_URL}/v1/admin/agents/stats`, admin.userId),
    safeFetch(`${PAYMENT_URL}/v1/admin/payments/stats`, admin.userId),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      users: userStats,
      wallets: walletStats,
      tasks: taskStats,
      agents: agentStats,
      payments: paymentStats,
    },
    error: null,
  });
}
