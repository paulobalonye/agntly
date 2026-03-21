import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const WALLET_URL = process.env.WALLET_SERVICE_URL ?? 'http://localhost:3002';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('agntly_token')?.value;
  const payload = token ? jwt.decode(token) as { userId: string } | null : null;
  const userId = payload?.userId;

  if (!userId) {
    return NextResponse.json({
      success: true,
      data: { balance: '0', locked: '0', address: '—', withdrawals: [] },
      error: null,
    });
  }

  try {
    // Get user's wallet
    const walletRes = await fetch(`${WALLET_URL}/v1/wallets`, {
      headers: { 'x-user-id': userId },
      cache: 'no-store',
    });

    if (!walletRes.ok) throw new Error('Wallet not found');

    const walletJson = await walletRes.json();
    const wallet = walletJson?.data;
    if (!wallet) throw new Error('No wallet data');

    // Get withdrawal history
    let withdrawals: unknown[] = [];
    try {
      const wdRes = await fetch(`${WALLET_URL}/v1/wallets/${wallet.id}/withdrawals?limit=10`, {
        headers: { 'x-user-id': userId },
      });
      if (wdRes.ok) {
        const wdJson = await wdRes.json();
        withdrawals = Array.isArray(wdJson.data) ? wdJson.data : [];
      }
    } catch {
      // Withdrawal history unavailable
    }

    return NextResponse.json({
      success: true,
      data: {
        balance: wallet.balance ?? '0',
        locked: wallet.locked ?? '0',
        address: wallet.address ?? '—',
        withdrawals: (withdrawals as Record<string, unknown>[]).map((w) => ({
          id: w.id,
          amount: w.amount,
          destination: w.destination,
          status: w.status,
          txHash: w.tx_hash ?? w.txHash ?? null,
          date: w.created_at ?? w.createdAt ?? '',
        })),
      },
      error: null,
    });
  } catch {
    return NextResponse.json({
      success: true,
      data: { balance: '0', locked: '0', address: '—', withdrawals: [] },
      error: null,
    });
  }
}
