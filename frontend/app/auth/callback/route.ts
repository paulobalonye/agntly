import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';

/**
 * Supabase magic-link callback.
 *
 * After the user clicks the email link, Supabase redirects here with
 * ?code=<pkce_code>. We exchange it for a session, persist it in cookies,
 * and redirect the user to the dashboard (or their original destination).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Safe redirect: only allow relative paths
      const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // Exchange failed or no code provided — send to login with error
  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`);
}
