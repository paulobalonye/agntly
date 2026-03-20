import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-bg-0">
      <div className="mb-8">
        <div className="font-mono text-sm font-medium text-accent flex items-center gap-2">
          <span className="w-2 h-2 bg-accent rounded-full animate-pulse-dot" />
          AGNTLY.IO
        </div>
      </div>
      <div className="bg-bg-1 border border-border p-10 w-full max-w-md">
        <h1 className="font-display text-2xl font-semibold text-t-0 mb-2">Sign in</h1>
        <p className="text-sm text-t-1 mb-8">Enter your email to receive a magic link</p>
        <Suspense fallback={<div className="text-t-2 font-mono text-sm">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
      <p className="mt-6 text-xs text-t-2 font-mono">
        No password needed · Link expires in 15 minutes
      </p>
    </div>
  );
}
