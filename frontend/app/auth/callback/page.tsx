'use client';
import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Suspense } from 'react';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/dashboard';
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

    if (!code) {
      router.replace('/auth/login?error=auth_callback_error');
      return;
    }

    // Use the browser client so the PKCE verifier stored during signInWithOtp
    // is accessible — it lives in the same browser cookie jar.
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        router.replace(`/auth/login?error=${encodeURIComponent(error.message)}`);
        return;
      }

      router.replace(safeNext);
    });
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-bg-0">
      <div className="bg-bg-1 border border-border p-10 w-full max-w-md text-center">
        <div className="w-8 h-8 border border-accent/30 bg-accent/10 animate-pulse mx-auto mb-4" />
        <p className="text-t-1 font-mono text-sm">Signing you in...</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-bg-0">
        <div className="w-8 h-8 border border-accent/30 bg-accent/10 animate-pulse" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
