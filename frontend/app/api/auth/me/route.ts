import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { success: false, data: null, error: 'Not authenticated' },
      { status: 401 },
    );
  }

  return NextResponse.json({ success: true, data: { user: session }, error: null });
}
