import { NextResponse } from 'next/server';
import { getAuthToken } from '@/lib/get-auth-token';

const WALLET_URL = process.env.WALLET_SERVICE_URL ?? 'http://localhost:3002';
const PAYMENT_URL = process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:3006';

export async function GET() {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({
      success: true,
      data: { balance: '0', locked: '0', address: '—', withdrawals: [] },
      error: null,
    });
  }

  try {
    // Get user's wallet
    const walletRes = await fetch(`${WALLET_URL}/v1/wallets`, {
      headers: { 'Authorization': `Bearer ${token}` },
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
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (wdRes.ok) {
        const wdJson = await wdRes.json();
        withdrawals = Array.isArray(wdJson.data) ? wdJson.data : [];
      }
    } catch {
      // Withdrawal history unavailable
    }

    // Get payment history (deposits)
    let deposits: unknown[] = [];
    try {
      const depRes = await fetch(`${PAYMENT_URL}/v1/payments/history?limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (depRes.ok) {
        const depJson = await depRes.json();
        deposits = Array.isArray(depJson.data) ? depJson.data : [];
      }
    } catch {
      // Payment history unavailable
    }

    // Combine into unified transaction list
    const transactions = [
      ...(withdrawals as Record<string, unknown>[]).map((w) => ({
        id: w.id,
        type: 'withdrawal' as const,
        amount: `-${w.amount}`,
        counterparty: String(w.destination ?? ''),
        status: String(w.status ?? 'completed'),
        date: String(w.created_at ?? w.createdAt ?? ''),
        txHash: w.tx_hash ?? w.txHash ?? null,
      })),
      ...(deposits as Record<string, unknown>[]).map((d) => ({
        id: d.id,
        type: 'deposit' as const,
        amount: `+${d.usdc_amount ?? d.usdcAmount ?? d.amount_usd ?? d.amountUsd ?? '0'}`,
        counterparty: 'Card funding',
        status: String(d.status ?? 'completed'),
        date: String(d.created_at ?? d.createdAt ?? ''),
        txHash: null,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      success: true,
      data: {
        balance: wallet.balance ?? '0',
        locked: wallet.locked ?? '0',
        address: wallet.address ?? '—',
        transactions,
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
