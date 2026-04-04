import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';

/**
 * Supabase magic-link callback.
 *
 * After the user clicks the email link, Supabase redirects here with
 * ?code=<pkce_code>. We exchange it for a session, persist it in cookies,
 * create a wallet for new users (fire-and-forget), and redirect the user
 * to their original destination (or /dashboard).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Ensure the user has a wallet — idempotent, safe to call on every login
      const walletUrl = process.env.WALLET_SERVICE_URL ?? 'http://localhost:3002';
      fetch(`${walletUrl}/v1/wallets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': data.user.id,
        },
        body: JSON.stringify({}),
      }).catch(() => { /* fire-and-forget */ });

      const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`);
}
