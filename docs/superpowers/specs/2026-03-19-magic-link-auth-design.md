# Plan B1: Magic Link Auth (Resend)

## Overview

Passwordless authentication via magic link emails. User enters email, auth-service generates a token and sends a magic link via Resend, user clicks the link, token is verified, JWT is issued and stored in an httpOnly cookie. No passwords, no OAuth — just email.

## Architecture

```
  User                   Frontend               Auth Service            Resend
  ────                   ────────               ────────────            ──────
   │                        │                        │                     │
   │──Enter email──────────▶│                        │                     │
   │                        │──POST /api/auth/login──▶│                     │
   │                        │                        │──POST /v1/auth/magic-link──▶
   │                        │                        │  Generate token              │
   │                        │                        │  Upsert user if new          │
   │                        │                        │  Store token hash            │
   │                        │                        │──Send email via Resend──────▶│
   │                        │◀─{ sent: true }────────│                     │
   │◀─"Check your email"────│                        │                     │
   │                        │                        │                     │──Email──▶ User
   │                        │                        │                     │
   │──Click magic link──────────────────────────────────────────────────────────────────
   │  https://app/auth/verify?token=xxx              │                     │
   │                        │                        │                     │
   │                        │──POST /api/auth/verify─▶│                     │
   │                        │                        │──POST /v1/auth/verify-magic-link
   │                        │                        │  Verify token hash           │
   │                        │                        │  Mark token as used          │
   │                        │                        │  Generate JWT + refresh      │
   │                        │◀─{ accessToken, user }──│                     │
   │                        │──Set httpOnly cookie────│                     │
   │◀─Redirect to /marketplace                       │                     │
```

## Auth-Service Additions

### Magic Link Tokens Table

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

Drizzle schema in `services/auth-service/src/db/magic-link-schema.ts`.

### ResendClient

Thin wrapper around the `resend` npm package:

```typescript
class ResendClient {
  async sendMagicLink(email: string, token: string): Promise<void>
}
```

- Sends from `noreply@agntly.io` (configure via `RESEND_FROM_EMAIL` env var)
- Subject: "Sign in to Agntly"
- Body: Clean HTML email with the magic link URL
- Magic link URL: `${FRONTEND_URL}/auth/verify?token=${token}`
- Token expires in 15 minutes
- Configured via `RESEND_API_KEY` env var

### MagicLinkService

```typescript
class MagicLinkService {
  async sendMagicLink(email: string): Promise<void>
  async verifyMagicLink(token: string): Promise<{ accessToken: string; refreshToken: string; user: User }>
}
```

**`sendMagicLink(email)`:**
1. Generate a random token: `crypto.randomBytes(32).toString('hex')`
2. Hash the token with SHA-256 for storage (raw token goes in the email, hash goes in DB)
3. Upsert user: if email doesn't exist in `users` table, create a new user with role `developer`
4. Delete any existing unused tokens for this email (prevent accumulation)
5. Insert token hash into `magic_link_tokens` with 15-minute expiry
6. Send email via ResendClient with the raw token in the magic link URL

**`verifyMagicLink(token)`:**
1. Hash the provided token with SHA-256
2. Lookup in `magic_link_tokens` by token_hash
3. Validate: exists, not expired (`expires_at > NOW()`), not used (`used_at IS NULL`)
4. Mark as used: `UPDATE SET used_at = NOW() WHERE token_hash = $1 AND used_at IS NULL` (atomic CAS)
5. Lookup the user by email
6. Generate JWT access token (15 min) + refresh token (7 days) — reuse existing `AuthService.generateTokens()`
7. Return tokens + user object

### New API Endpoints

**POST /v1/auth/magic-link**
```json
Request:  { "email": "dev@example.com" }
Response: { "success": true, "data": { "sent": true } }
```

**POST /v1/auth/verify-magic-link**
```json
Request:  { "token": "raw-hex-token" }
Response: {
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "...",
    "expiresIn": 900,
    "user": { "id": "uuid", "email": "dev@example.com", "role": "developer" }
  }
}
```

Error cases:
- Invalid/expired/used token → 401 "Invalid or expired magic link"
- Rate limit: max 3 magic links per email per 15 minutes → 429 "Too many requests"

## Frontend Auth Layer

### Login Page (`/auth/login`)

Client component with two states:
1. **Email input** — email field + "Send magic link" button
2. **Check your email** — success message after submission

The form calls `POST /api/auth/login` (Next.js BFF route).

### Verify Page (`/auth/verify`)

Client component that:
1. Reads `?token=xxx` from URL search params
2. Calls `POST /api/auth/verify` with the token
3. On success: sets httpOnly cookie (via BFF response header) + redirects to `/marketplace`
4. On failure: shows "Link expired" with a "Send new link" button

### Next.js BFF Auth Routes

**POST /api/auth/login**
- Proxies to auth-service `POST /v1/auth/magic-link`
- Returns `{ sent: true }`

**POST /api/auth/verify**
- Proxies to auth-service `POST /v1/auth/verify-magic-link`
- On success: sets `agntly_token` httpOnly cookie with the JWT
- Returns `{ user }` (without tokens — they're in the cookie)

**GET /api/auth/me**
- Reads `agntly_token` cookie
- Decodes JWT (without verifying — the auth-service already verified it)
- Returns `{ user: { id, email, role } }` or 401

**POST /api/auth/logout**
- Clears the `agntly_token` cookie
- Returns `{ loggedOut: true }`

### Cookie Configuration

```typescript
cookies().set('agntly_token', accessToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 900, // 15 minutes (matches JWT expiry)
  path: '/',
});
```

### Next.js Middleware

`frontend/middleware.ts` — runs on every request to protected routes:

```typescript
export const config = {
  matcher: ['/marketplace/:path*', '/dashboard/:path*', '/onboard/:path*'],
};
```

Checks for `agntly_token` cookie:
- If present: continue (JWT validation is deferred to API routes)
- If absent: redirect to `/auth/login?redirect={originalPath}`

After login, the verify page reads the `redirect` query param and sends the user back to where they were going.

### Auth Context

`frontend/lib/auth.ts` exports:
- `getSession()` — server-side: reads cookie, decodes JWT, returns user or null
- `useAuth()` — client-side hook: calls `/api/auth/me` on mount, provides `{ user, loading, logout }`

## Files

| Action | Path | Purpose |
|--------|------|---------|
| Create | `services/auth-service/src/services/resend-client.ts` | Resend SDK wrapper |
| Create | `services/auth-service/src/services/magic-link-service.ts` | Token gen, verify, user upsert |
| Create | `services/auth-service/src/db/magic-link-schema.ts` | magic_link_tokens Drizzle schema |
| Create | `services/auth-service/src/repositories/magic-link-repository.ts` | Token CRUD + CAS |
| Modify | `services/auth-service/src/routes/auth.ts` | Add magic-link + verify endpoints |
| Modify | `services/auth-service/src/server.ts` | Wire MagicLinkService |
| Modify | `services/auth-service/package.json` | Add resend dependency |
| Modify | `scripts/migrate.sql` | Add magic_link_tokens table |
| Create | `frontend/app/auth/login/page.tsx` | Login form page |
| Create | `frontend/app/auth/verify/page.tsx` | Token verification page |
| Create | `frontend/components/auth/LoginForm.tsx` | Email input component |
| Create | `frontend/lib/auth.ts` | getSession, useAuth |
| Create | `frontend/middleware.ts` | Protected route middleware |
| Create | `frontend/app/api/auth/login/route.ts` | BFF: send magic link |
| Create | `frontend/app/api/auth/verify/route.ts` | BFF: verify + set cookie |
| Create | `frontend/app/api/auth/me/route.ts` | BFF: get current user |
| Create | `frontend/app/api/auth/logout/route.ts` | BFF: clear cookie |

## Environment Variables

```env
# Auth service
RESEND_API_KEY=re_XGF9tXN3_8mZyoVFkZtH7QRDLeapmCjKh
RESEND_FROM_EMAIL=noreply@agntly.io
FRONTEND_URL=http://localhost:3100

# Frontend
NEXT_PUBLIC_APP_URL=http://localhost:3100
AUTH_SERVICE_URL=http://localhost:3001
```

## Testing

Integration tests for the auth-service magic link flow:
1. Send magic link → token created in DB, returns `{ sent: true }`
2. Verify valid token → returns JWT + user, token marked as used
3. Verify expired token → returns 401
4. Verify already-used token → returns 401
5. Verify non-existent token → returns 401
6. Send magic link for new email → user auto-created
7. Rate limit: 4th request within 15 min → returns 429

Frontend auth is tested by visual verification (login form renders, redirect works).
