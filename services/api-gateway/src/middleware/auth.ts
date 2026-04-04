import jwt from 'jsonwebtoken';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { enforceApiKeyRateLimit } from './api-key-rate-limit.js';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    console.error('FATAL: JWT_SECRET env var is required and must be at least 32 characters');
    process.exit(1);
  }
  return secret;
}

const JWT_SECRET: string = getJwtSecret();
function getInternalSecret(): string {
  const secret = process.env.INTERNAL_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    console.error('FATAL: INTERNAL_SIGNING_SECRET env var is required and must be at least 32 characters');
    process.exit(1);
  }
  return secret;
}

const INTERNAL_SECRET: string = getInternalSecret();

const AGNTLY_API_KEY = process.env.AGNTLY_API_KEY ?? null;

const SUPABASE_URL = process.env.SUPABASE_URL ?? null;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;

/** Lazy Supabase admin client — only created if env vars are present */
function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const supabaseAdmin = getSupabaseAdmin();

/** Decode a JWT payload without verifying the signature — used only to inspect claims. */
function getJwtIssuer(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    return typeof payload.iss === 'string' ? payload.iss : null;
  } catch {
    return null;
  }
}

/** Constant-time string comparison to prevent timing attacks */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface AuthContext {
  readonly userId: string;
  readonly email: string;
  readonly role: string;
  readonly authType: 'jwt' | 'api-key' | 'supabase';
}

/** Inject identity headers + HMAC signature so downstream services trust them */
function injectIdentity(
  request: FastifyRequest,
  userId: string,
  email: string,
  role: string,
): void {
  request.headers['x-user-id'] = userId;
  request.headers['x-user-email'] = email;
  request.headers['x-user-role'] = role;
  const signingPayload = `${userId}:${email}:${role}`;
  const signature = createHmac('sha256', INTERNAL_SECRET).update(signingPayload).digest('hex');
  request.headers['x-gateway-signature'] = signature;
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;

  if (!header) {
    return reply.status(401).send({
      success: false,
      data: null,
      error: 'Authorization header required',
    });
  }

  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return reply.status(401).send({
      success: false,
      data: null,
      error: 'Invalid authorization format. Use: Bearer <token>',
    });
  }

  // Platform master key — starts with 'agntly_'
  // Validated directly against AGNTLY_API_KEY env var (no DB lookup)
  if (token.startsWith('agntly_')) {
    if (!AGNTLY_API_KEY || !safeEqual(token, AGNTLY_API_KEY)) {
      return reply.status(401).send({ success: false, data: null, error: 'Invalid API key' });
    }
    injectIdentity(request, 'platform', 'platform@agntly.io', 'admin');
    return;
  }

  // API key — starts with 'ag_'
  // Validate against auth-service and inject user identity headers
  if (token.startsWith('ag_')) {
    try {
      const authUrl = process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001';
      const res = await fetch(`${authUrl}/v1/auth/validate-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: token }),
      });
      if (!res.ok) {
        return reply.status(401).send({ success: false, data: null, error: 'Invalid API key' });
      }
      const data = await res.json() as { data: { userId: string; role?: string } };
      const { userId } = data.data;
      const role = data.data.role ?? 'developer';

      // Per-API-key rate limiting (returns false if 429 was sent)
      const allowed = await enforceApiKeyRateLimit(token, reply);
      if (!allowed) return;

      injectIdentity(request, userId, 'api-key-user', role);
      return;
    } catch {
      return reply.status(401).send({ success: false, data: null, error: 'API key validation failed' });
    }
  }

  // Supabase JWT — issued by Supabase Auth (detectable via `iss` claim)
  const issuer = getJwtIssuer(token);
  if (issuer && issuer.includes('supabase.co') && supabaseAdmin) {
    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) {
        return reply.status(401).send({ success: false, data: null, error: 'Invalid or expired token' });
      }
      const role = (user.user_metadata?.role as string | undefined) ?? 'developer';
      injectIdentity(request, user.id, user.email ?? '', role);
      return;
    } catch {
      return reply.status(401).send({ success: false, data: null, error: 'Token verification failed' });
    }
  }

  // Legacy JWT — our own tokens signed with JWT_SECRET
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      role: string;
    };
    injectIdentity(request, payload.userId, payload.email, payload.role);
  } catch {
    return reply.status(401).send({
      success: false,
      data: null,
      error: 'Invalid or expired token',
    });
  }
}
