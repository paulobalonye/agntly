import jwt from 'jsonwebtoken';
import type { FastifyRequest, FastifyReply } from 'fastify';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production-min-32';

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
  // Pass through to the backend service which validates against the DB
  if (token.startsWith('ag_')) {
    return;
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
  } catch {
    return reply.status(401).send({
      success: false,
      data: null,
      error: 'Invalid or expired token',
    });
  }
}
