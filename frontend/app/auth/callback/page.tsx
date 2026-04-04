'use client';
import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const next = searchParams.get('next') ?? '/dashboard';
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

    const supabase = createSupabaseBrowserClient();

    // With implicit flow, Supabase puts tokens in the URL hash.
    // onAuthStateChange fires SIGNED_IN once the client processes the hash.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        subscription.unsubscribe();
        router.replace(safeNext);
      }
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        // ignore
      }
    });

    // If already signed in (e.g. refresh), redirect immediately
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        subscription.unsubscribe();
        router.replace(safeNext);
      }
    });

    // Fallback: if nothing fires after 8s, send to login with error
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      router.replace('/auth/login?error=auth_callback_error');
    }, 8000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
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
