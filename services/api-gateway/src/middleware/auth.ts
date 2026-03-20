import jwt from 'jsonwebtoken';
import { createHmac } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    console.error('FATAL: JWT_SECRET env var is required and must be at least 32 characters');
    process.exit(1);
  }
  return secret;
}

const JWT_SECRET: string = getJwtSecret();
const INTERNAL_SECRET = process.env.INTERNAL_SIGNING_SECRET ?? (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: INTERNAL_SIGNING_SECRET is required in production');
    process.exit(1);
  }
  return 'dev-internal-secret-not-for-production';
})();

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
      const data = await res.json() as { data: { userId: string } };
      request.headers['x-user-id'] = data.data.userId;
      request.headers['x-user-email'] = '';
      request.headers['x-user-role'] = 'user';
      // Sign the forwarded identity so downstream services can verify headers came from the gateway
      const signingPayload = `${data.data.userId}::`;
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
