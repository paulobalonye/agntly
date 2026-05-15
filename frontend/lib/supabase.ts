import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Re-export browser client for convenience — but prefer importing from
// supabase-browser.ts directly in 'use client' files to avoid bundling
// next/headers into client bundles.
export { createSupabaseBrowserClient } from './supabase-browser';

/**
 * Server-side Supabase client (Server Components, API routes, middleware).
 * Do NOT import this in 'use client' components — use supabase-browser.ts instead.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { flowType: 'implicit' },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
}
