import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';

export async function POST(request: NextRequest) {
  let body: { email?: string; redirect?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.email || typeof body.email !== 'string') {
    return NextResponse.json({ success: false, error: 'Valid email required' }, { status: 400 });
  }

  // Thread the post-login destination through the callback URL so
  // /auth/callback can redirect the user to where they were trying to go.
  const next = typeof body.redirect === 'string' && body.redirect.startsWith('/') && !body.redirect.startsWith('//')
    ? body.redirect
    : '/dashboard';

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: body.email,
      options: {
        emailRedirectTo: `${APP_URL}/auth/callback?next=${encodeURIComponent(next)}`,
        shouldCreateUser: true,
      },
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: { sent: true }, error: null });
  } catch {
    return NextResponse.json({ success: false, error: 'Auth service unavailable' }, { status: 503 });
  }
}
