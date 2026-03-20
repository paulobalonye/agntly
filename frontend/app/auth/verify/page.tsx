'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setError('No token provided');
      return;
    }

    fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Verification failed');
        }
        setStatus('success');
        setTimeout(() => {
          // Check for stored redirect from login page (saved as cookie)
          const redirectCookie = document.cookie.match(/agntly_redirect=([^;]+)/)?.[1];
          const storedRedirect = redirectCookie ? decodeURIComponent(redirectCookie) : null;
          const safeRedirect = storedRedirect && storedRedirect.startsWith('/') && !storedRedirect.startsWith('//') ? storedRedirect : null;
          // Clear the redirect cookie
          document.cookie = 'agntly_redirect=; path=/; max-age=0';

          // Priority: stored redirect > URL param > role-based default
          const roleCookie = document.cookie.match(/agntly_role=([^;]+)/)?.[1];
          const defaultRedirect = roleCookie === 'builder' ? '/dashboard' : '/marketplace';
          const redirect = safeRedirect || searchParams.get('redirect') || defaultRedirect;
          router.push(redirect);
        }, 1500);
      })
      .catch((err) => {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Verification failed');
      });
  }, [searchParams, router]);

  return (
    <div className="bg-bg-1 border border-border p-10 w-full max-w-md text-center">
      {status === 'verifying' && (
        <>
          <div className="w-8 h-8 border border-accent/30 bg-accent/10 animate-pulse-dot mx-auto mb-4" />
          <p className="text-t-1 font-mono text-sm">Verifying your magic link...</p>
        </>
      )}
      {status === 'success' && (
        <>
          <div className="text-accent text-3xl mb-4">✓</div>
          <h2 className="font-display text-xl font-semibold text-t-0 mb-2">You&apos;re in!</h2>
          <p className="text-sm text-t-1">Redirecting to the marketplace...</p>
        </>
      )}
      {status === 'error' && (
        <>
          <div className="text-red text-3xl mb-4">✕</div>
          <h2 className="font-display text-xl font-semibold text-t-0 mb-2">Link expired</h2>
          <p className="text-sm text-t-1 mb-6">{error}</p>
          <a
            href="/auth/login"
            className="bg-accent text-bg-0 font-mono text-xs font-medium px-6 py-3 tracking-wider inline-block"
          >
            send new link →
          </a>
        </>
      )}
    </div>
  );
}

function VerifyFallback() {
  return (
    <div className="bg-bg-1 border border-border p-10 w-full max-w-md text-center">
      <div className="w-8 h-8 border border-accent/30 bg-accent/10 animate-pulse-dot mx-auto mb-4" />
      <p className="text-t-1 font-mono text-sm">Loading...</p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-bg-0">
      <Suspense fallback={<VerifyFallback />}>
        <VerifyContent />
      </Suspense>
    </div>
  );
}
