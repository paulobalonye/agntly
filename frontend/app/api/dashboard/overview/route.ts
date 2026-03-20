import { NextResponse } from 'next/server';

export async function GET() {
  const data = {
    totalEarned: '1,240.50',
    earningsToday: '47.82',
    activeAgents: 3,
    avgRating: 4.91,
  };

  return NextResponse.json({ success: true, data, error: null });
}
