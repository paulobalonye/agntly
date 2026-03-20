# Plan B1: Magic Link Auth (Resend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add passwordless magic link authentication using Resend for email delivery. Users enter their email, receive a magic link, click it, and get a JWT session stored in an httpOnly cookie. Both auth-service backend and Next.js frontend auth layer.

**Architecture:** Auth-service gets a MagicLinkService that generates tokens, stores hashes in a new `magic_link_tokens` table, and sends emails via Resend. The Next.js frontend has a login page, verify page, BFF auth routes (proxy to auth-service + cookie management), and middleware to protect routes.

**Tech Stack:** Resend SDK, crypto (SHA-256 + randomBytes), JWT, httpOnly cookies, Next.js middleware

**Spec:** `docs/superpowers/specs/2026-03-19-magic-link-auth-design.md`

---

## File Structure

### Auth-service additions
- `services/auth-service/src/services/resend-client.ts` — Resend SDK wrapper
- `services/auth-service/src/services/magic-link-service.ts` — Token gen/verify + user upsert
- `services/auth-service/src/db/magic-link-schema.ts` — Drizzle schema

### Frontend auth layer
- `frontend/app/auth/login/page.tsx` — Login page
- `frontend/app/auth/verify/page.tsx` — Verify + redirect page
- `frontend/components/auth/LoginForm.tsx` — Email form component
- `frontend/lib/auth.ts` — Auth utilities
- `frontend/middleware.ts` — Protected route guard
- `frontend/app/api/auth/login/route.ts` — BFF: send magic link
- `frontend/app/api/auth/verify/route.ts` — BFF: verify + set cookie
- `frontend/app/api/auth/me/route.ts` — BFF: current user
- `frontend/app/api/auth/logout/route.ts` — BFF: clear cookie

---

## Task 1: Auth-service magic link backend

Add Resend, magic link token table, and two new endpoints to the auth-service.

**Files:**
- Modify: `services/auth-service/package.json` — Add `resend` dependency
- Create: `services/auth-service/src/db/magic-link-schema.ts`
- Create: `services/auth-service/src/services/resend-client.ts`
- Create: `services/auth-service/src/services/magic-link-service.ts`
- Modify: `services/auth-service/src/routes/auth.ts` — Add magic-link + verify endpoints
- Modify: `services/auth-service/src/server.ts` — Wire MagicLinkService
- Modify: `scripts/migrate.sql` — Add magic_link_tokens table

### Implementation details

**Read first:**
- `services/auth-service/src/services/auth-service.ts` — existing AuthService with `generateTokens()` method and in-memory user storage
- `services/auth-service/src/routes/auth.ts` — existing routes pattern
- `services/auth-service/src/server.ts` — current wiring
- `services/auth-service/src/db/schema.ts` — users table Drizzle schema
- `docs/superpowers/specs/2026-03-19-magic-link-auth-design.md` — full spec

**magic-link-schema.ts:**
```typescript
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const magicLinkTokens = pgTable('magic_link_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**resend-client.ts:**
```typescript
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@agntly.io';
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3100';

export interface IResendClient {
  sendMagicLink(email: string, token: string): Promise<void>;
}

export class ResendClient implements IResendClient {
  private readonly resend: Resend;

  constructor(apiKey?: string) {
    this.resend = new Resend(apiKey ?? RESEND_API_KEY);
  }

  async sendMagicLink(email: string, token: string): Promise<void> {
    const magicLinkUrl = `${FRONTEND_URL}/auth/verify?token=${token}`;

    await this.resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Sign in to Agntly',
      html: `
        <div style="font-family:'IBM Plex Mono',monospace;background:#07090d;color:#e8edf2;padding:40px;max-width:480px;margin:0 auto">
          <div style="color:#00e5a0;font-size:14px;margin-bottom:24px">● AGNTLY.IO</div>
          <h2 style="font-size:20px;font-weight:600;margin-bottom:16px">Sign in to Agntly</h2>
          <p style="color:#8fa8c0;font-size:14px;line-height:1.6;margin-bottom:24px">Click the button below to sign in. This link expires in 15 minutes.</p>
          <a href="${magicLinkUrl}" style="display:inline-block;background:#00e5a0;color:#07090d;font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:500;padding:12px 28px;text-decoration:none;letter-spacing:0.04em">sign in →</a>
          <p style="color:#4d6478;font-size:12px;margin-top:24px">If you didn't request this, ignore this email.</p>
        </div>
      `,
    });
  }
}
```

**magic-link-service.ts:**

The MagicLinkService needs access to the users store AND the generateTokens method from AuthService. Since AuthService uses in-memory Maps, the MagicLinkService will also use in-memory storage for magic link tokens (matching the existing pattern). It imports the email→userId index from AuthService.

Key methods:
- `sendMagicLink(email)` — generate random token, hash with SHA-256, store hash, upsert user if new, send via Resend
- `verifyMagicLink(token)` — hash token, lookup, validate (not expired, not used), mark used (CAS), generate JWT via AuthService

The service should:
1. Use `crypto.randomBytes(32).toString('hex')` for the raw token
2. Use `crypto.createHash('sha256').update(token).digest('hex')` for the hash
3. Store tokens in a Map with expiry (15 min) — matching existing in-memory pattern
4. Auto-create user on first login (upsert) via AuthService
5. Reuse `AuthService.generateTokens()` for JWT creation

**Route additions** (add to existing `auth.ts`):

```typescript
// POST /magic-link
app.post('/magic-link', async (request, reply) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send(createErrorResponse('Valid email required'));
  try {
    await magicLinkService.sendMagicLink(parsed.data.email);
    return reply.status(200).send(createApiResponse({ sent: true }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to send magic link';
    const status = msg.includes('Too many') ? 429 : 400;
    return reply.status(status).send(createErrorResponse(msg));
  }
});

// POST /verify-magic-link
app.post('/verify-magic-link', async (request, reply) => {
  const schema = z.object({ token: z.string().min(1) });
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send(createErrorResponse('Token required'));
  try {
    const result = await magicLinkService.verifyMagicLink(parsed.data.token);
    return reply.status(200).send(createApiResponse(result));
  } catch (err) {
    return reply.status(401).send(createErrorResponse('Invalid or expired magic link'));
  }
});
```

**migrate.sql addition** (add after the auth service section):
```sql
CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_magic_link_email ON magic_link_tokens(email);
```

**After implementing:**
1. Add `"resend": "^4.0.0"` to auth-service package.json dependencies
2. Install: `cd /Users/drpraize/agntly && pnpm install`
3. Build: `pnpm --filter @agntly/auth-service build`
4. Commit: `git add services/auth-service/ scripts/migrate.sql && git commit -m "feat: add magic link auth with Resend email delivery"`

---

## Task 2: Frontend login + verify pages

**Files:**
- Create: `frontend/components/auth/LoginForm.tsx`
- Create: `frontend/app/auth/login/page.tsx`
- Create: `frontend/app/auth/verify/page.tsx`

### Implementation details

**LoginForm.tsx** — Client component with two states:

State 1 (email input): Email field + "Send magic link" button. On submit, POST to `/api/auth/login`. Shows loading spinner during request.

State 2 (success): "Check your email" message with the email shown. "Didn't receive it? Send again" link that resets to state 1.

Style matches the mockup aesthetic: dark background, accent-colored button, monospace labels, sharp corners.

```tsx
'use client';
import { useState } from 'react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send');
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
        <div className="w-16 h-16 border border-accent/30 bg-accent/[0.06] flex items-center justify-center text-2xl">✉</div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-t-0 mb-2">Check your email</h2>
          <p className="text-sm text-t-1">We sent a magic link to <span className="text-accent font-mono">{email}</span></p>
        </div>
        <button onClick={() => setSent(false)} className="font-mono text-xs text-t-2 hover:text-t-1 transition-colors">
          Didn't receive it? Send again
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full max-w-sm">
      <div>
        <label className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-2 block">email address</label>
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
```

**login/page.tsx:**
```tsx
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
        <LoginForm />
      </div>
      <p className="mt-6 text-xs text-t-2 font-mono">No password needed · Link expires in 15 minutes</p>
    </div>
  );
}
```

**verify/page.tsx** — Client component that reads `?token=` and verifies:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) { setStatus('error'); setError('No token provided'); return; }

    fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Verification failed'); }
        setStatus('success');
        // Redirect after brief success message
        setTimeout(() => {
          const redirect = searchParams.get('redirect') || '/marketplace';
          router.push(redirect);
        }, 1500);
      })
      .catch((err) => {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Verification failed');
      });
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-bg-0">
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
            <h2 className="font-display text-xl font-semibold text-t-0 mb-2">You're in!</h2>
            <p className="text-sm text-t-1">Redirecting to the marketplace...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-red text-3xl mb-4">✕</div>
            <h2 className="font-display text-xl font-semibold text-t-0 mb-2">Link expired</h2>
            <p className="text-sm text-t-1 mb-6">{error}</p>
            <a href="/auth/login" className="bg-accent text-bg-0 font-mono text-xs font-medium px-6 py-3 tracking-wider inline-block">
              send new link →
            </a>
          </>
        )}
      </div>
    </div>
  );
}
```

Wrap verify page in a Suspense boundary since it uses `useSearchParams`:
The `app/auth/verify/page.tsx` should actually export a wrapper that wraps the client component in Suspense. Alternatively, the implementer can use `dynamic(() => import(...), { ssr: false })`.

**After implementing:**
```bash
git add frontend/components/auth/ frontend/app/auth/
git commit -m "feat: add magic link login and verify pages"
```

---

## Task 3: Frontend BFF auth routes + middleware

**Files:**
- Create: `frontend/app/api/auth/login/route.ts`
- Create: `frontend/app/api/auth/verify/route.ts`
- Create: `frontend/app/api/auth/me/route.ts`
- Create: `frontend/app/api/auth/logout/route.ts`
- Create: `frontend/lib/auth.ts`
- Create: `frontend/middleware.ts`

### Implementation details

**BFF routes** proxy to the auth-service and manage cookies:

**login/route.ts:**
```typescript
import { NextRequest, NextResponse } from 'next/server';

const AUTH_URL = process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const res = await fetch(`${AUTH_URL}/v1/auth/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

**verify/route.ts:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_URL = process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const res = await fetch(`${AUTH_URL}/v1/auth/verify-magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  }

  const data = await res.json();
  const { accessToken, user } = data.data;

  // Set httpOnly cookie
  const cookieStore = await cookies();
  cookieStore.set('agntly_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 900,
    path: '/',
  });

  return NextResponse.json({ success: true, data: { user }, error: null });
}
```

**me/route.ts:**
```typescript
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, data: null, error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json({ success: true, data: { user: session }, error: null });
}
```

**logout/route.ts:**
```typescript
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('agntly_token');
  return NextResponse.json({ success: true, data: { loggedOut: true }, error: null });
}
```

**lib/auth.ts:**
```typescript
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

interface UserSession {
  userId: string;
  email: string;
  role: string;
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('agntly_token')?.value;
  if (!token) return null;

  try {
    // Decode without verifying — the auth-service already verified when issuing
    const payload = jwt.decode(token) as { userId: string; email: string; role: string; exp: number } | null;
    if (!payload) return null;
    // Check expiry
    if (payload.exp * 1000 < Date.now()) return null;
    return { userId: payload.userId, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}
```

Note: `jsonwebtoken` needs to be added to frontend package.json dependencies.

**middleware.ts:**
```typescript
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('agntly_token')?.value;

  if (!token) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/marketplace/:path*', '/dashboard/:path*', '/onboard/:path*'],
};
```

**After implementing:**
1. Add `jsonwebtoken` and `@types/jsonwebtoken` to frontend: `cd frontend && pnpm add jsonwebtoken && pnpm add -D @types/jsonwebtoken`
2. Build: `cd /Users/drpraize/agntly/frontend && pnpm build`
3. Commit:
```bash
git add frontend/app/api/auth/ frontend/lib/auth.ts frontend/middleware.ts frontend/package.json frontend/pnpm-lock.yaml
git commit -m "feat: add BFF auth routes, session management, and protected route middleware"
```

---

## Task 4: Integration tests for magic link flow

**Files:**
- Create: `tests/integration/magic-link.test.ts`

### Implementation details

Test the auth-service magic link endpoints directly (no frontend). Follow the existing test pattern from `tests/integration/setup.ts`.

Since the auth-service currently uses in-memory storage (not PostgreSQL), the tests instantiate `MagicLinkService` and `AuthService` directly and test the methods.

**Test cases:**
1. `sendMagicLink(email)` → returns without error, calling resend mock
2. `verifyMagicLink(token)` with valid token → returns JWT + user
3. `verifyMagicLink(token)` with expired token → throws
4. `verifyMagicLink(token)` with already-used token → throws
5. `verifyMagicLink(badToken)` with non-existent token → throws
6. `sendMagicLink(newEmail)` for new user → auto-creates user, verify succeeds
7. Rate limit: 4th `sendMagicLink` within 15 min → throws "Too many requests"

Use a mock ResendClient (`IResendClient` interface) that records calls instead of sending real emails.

**After implementing:**
```bash
git add tests/integration/magic-link.test.ts
git commit -m "test: add magic link auth integration tests"
```

---

## Summary

| Task | What it does | Files |
|------|-------------|-------|
| 1 | Auth-service magic link backend | `resend-client.ts`, `magic-link-service.ts`, `magic-link-schema.ts`, route + server updates |
| 2 | Frontend login + verify pages | `LoginForm.tsx`, `login/page.tsx`, `verify/page.tsx` |
| 3 | BFF auth routes + middleware | 4 API routes, `lib/auth.ts`, `middleware.ts` |
| 4 | Integration tests | `magic-link.test.ts` (7 test cases) |

**Total: 4 tasks, ~17 files.**

**Environment variables needed:**
```env
RESEND_API_KEY=re_XGF9tXN3_8mZyoVFkZtH7QRDLeapmCjKh
RESEND_FROM_EMAIL=noreply@agntly.io
FRONTEND_URL=http://localhost:3100
AUTH_SERVICE_URL=http://localhost:3001
```
