import { NextResponse } from 'next/server';

const MOCK_WALLET = {
  balance: '1,240.500000',
  locked: '45.000000',
  address: '0xA9c3B7d8E2f1C4a5D6b9F0e3A7c8B2d1E4f5A6b7',
  withdrawals: [
    {
      id: 'wd_001',
      amount: '500.000000',
      destination: '0x71Be63f3...8F5A',
      status: 'completed',
      txHash: '0xabc123...def456',
      date: '2026-03-18',
    },
    {
      id: 'wd_002',
      amount: '200.000000',
      destination: '0x71Be63f3...8F5A',
      status: 'processing',
      txHash: '0x789xyz...012abc',
      date: '2026-03-19',
    },
    {
      id: 'wd_003',
      amount: '100.000000',
      destination: '0x71Be63f3...8F5A',
      status: 'queued',
      txHash: null,
      date: '2026-03-19',
    },
  ],
};

export async function GET() {
  return NextResponse.json({ success: true, data: MOCK_WALLET, error: null });
}

export async function POST() {
  // Simulated withdrawal — always succeeds
  return NextResponse.json({
    success: true,
    data: { message: 'Withdrawal queued successfully.' },
    error: null,
  });
}
