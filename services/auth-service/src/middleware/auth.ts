import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { createErrorResponse } from '@agntly/shared';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production-min-32';

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header) {
    return reply.status(401).send(createErrorResponse('Authorization header required'));
  }

  const [scheme, token] = header.split(' ');

  if (scheme === 'Bearer' && token?.startsWith('ag_')) {
    (request as any).authType = 'api-key';
    (request as any).apiKey = token;
    return;
  }

  if (scheme === 'Bearer' && token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string };
      (request as any).userId = payload.userId;
      (request as any).userEmail = payload.email;
      (request as any).userRole = payload.role;
      (request as any).authType = 'jwt';
      return;
    } catch {
      return reply.status(401).send(createErrorResponse('Invalid or expired token'));
    }
  }

  return reply.status(401).send(createErrorResponse('Invalid authorization format'));
}
