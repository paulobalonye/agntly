import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('agntly_token');
  return NextResponse.json({ success: true, data: { loggedOut: true }, error: null });
}
