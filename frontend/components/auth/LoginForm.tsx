'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchParams = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Pass the redirect destination so /auth/callback can honour it
    const redirect = searchParams.get('redirect') ?? '/dashboard';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirect }),
      });
      if (!res.ok) {
        let message = 'Failed to send magic link';
        try {
          const data = await res.json();
          message = (data as { error?: string }).error ?? message;
        } catch { /* body was empty or non-JSON */ }
        throw new Error(message);
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="w-16 h-16 border border-accent/30 bg-accent/[0.06] flex items-center justify-center text-2xl">
          ✉
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-t-0 mb-2">Check your email</h2>
          <p className="text-sm text-t-1">
            We sent a magic link to <span className="text-accent font-mono">{email}</span>
          </p>
        </div>
        <button
          onClick={() => setSent(false)}
          className="font-mono text-xs text-t-2 hover:text-t-1 transition-colors"
        >
          Didn&apos;t receive it? Send again
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full max-w-sm">
      <div>
        <label className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-2 block">
          email address
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full bg-bg-2 border border-border text-t-0 font-mono text-sm px-4 py-3 outline-none focus:border-accent transition-colors placeholder:text-t-3"
        />
      </div>
      {error && <p className="text-red text-xs font-mono">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-accent text-bg-0 font-mono text-xs font-medium py-3 tracking-wider hover:bg-accent-2 transition-colors disabled:opacity-50"
      >
        {loading ? 'sending...' : 'send magic link →'}
      </button>
    </form>
  );
}
