'use client';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function VerifyError({ error, reset }: ErrorProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-bg-0">
      <div className="bg-bg-1 border border-border p-10 w-full max-w-md text-center">
        <div className="text-red text-3xl mb-4">!</div>
        <h2 className="font-display text-xl font-semibold text-t-0 mb-2">Something went wrong</h2>
        <p className="text-sm text-t-1 mb-6">
          {error.message || 'Verification failed unexpectedly'}
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="bg-accent text-bg-0 font-mono text-xs font-medium px-6 py-3 tracking-wider"
          >
            try again
          </button>
          <a
            href="/auth/login"
            className="border border-border text-t-1 font-mono text-xs font-medium px-6 py-3 tracking-wider"
          >
            send new link
          </a>
        </div>
      </div>
    </div>
  );
}
