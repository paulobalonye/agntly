import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // Sign-out failure should not block the response
  }

  return NextResponse.json({ success: true, data: { loggedOut: true }, error: null });
}
