import jwt from 'jsonwebtoken';
import { createHmac } from 'node:crypto';
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
  readonly authType: 'jwt' | 'api-key';
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
    request.headers['x-user-id'] = 'platform';
    request.headers['x-user-email'] = 'platform@agntly.io';
    request.headers['x-user-role'] = 'admin';
    const signingPayload = 'platform:platform@agntly.io:admin';
    const signature = createHmac('sha256', INTERNAL_SECRET).update(signingPayload).digest('hex');
    request.headers['x-gateway-signature'] = signature;
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
      if (!allowed) {
        return;
      }

      request.headers['x-user-id'] = userId;
      request.headers['x-user-email'] = 'api-key-user';
      request.headers['x-user-role'] = role;
      // Sign the forwarded identity so downstream services can verify headers came from the gateway
      const signingPayload = `${userId}:api-key-user:developer`;
      const signature = createHmac('sha256', INTERNAL_SECRET).update(signingPayload).digest('hex');
      request.headers['x-gateway-signature'] = signature;
      return;
    } catch {
      return reply.status(401).send({ success: false, data: null, error: 'API key validation failed' });
    }
  }

  // JWT — validate signature and expiry
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      role: string;
    };

    // Inject user context headers so downstream services can read them without re-verifying the JWT
    request.headers['x-user-id'] = payload.userId;
    request.headers['x-user-email'] = payload.email;
    request.headers['x-user-role'] = payload.role;

    // Sign the forwarded identity so downstream services can verify headers came from the gateway
    const signingPayload = `${payload.userId}:${payload.email}:${payload.role}`;
    const signature = createHmac('sha256', INTERNAL_SECRET).update(signingPayload).digest('hex');
    request.headers['x-gateway-signature'] = signature;
  } catch {
    return reply.status(401).send({
      success: false,
      data: null,
      error: 'Invalid or expired token',
    });
  }
}
