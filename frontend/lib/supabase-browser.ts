import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser (client component) Supabase client — safe to import in 'use client' files.
 * Uses implicit flow: magic link tokens arrive in the URL hash, no PKCE exchange needed.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { flowType: 'implicit' },
    },
  );
}
