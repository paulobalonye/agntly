import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import type { AuthService } from '../services/auth-service.js';
import type { MagicLinkService } from '../services/magic-link-service.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  const decorated = app as unknown as { authService: AuthService; magicLinkService: MagicLinkService; apiKeyService: import('../services/api-key-service.js').ApiKeyService };
  const authService = decorated.authService;
  const magicLinkService = decorated.magicLinkService;

  app.post('/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(createErrorResponse(parsed.error.issues[0]?.message ?? 'Invalid input'));
    }
    try {
      const result = await authService.register(parsed.data.email, parsed.data.password);
      return reply.status(201).send(createApiResponse(result));
    } catch (err) {
      // Don't reveal whether email exists
      return reply.status(409).send(createErrorResponse('Registration failed'));
    }
  });

  app.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(createErrorResponse('Invalid credentials format'));
    }
    try {
      const result = await authService.login(parsed.data.email, parsed.data.password);
      return reply.status(200).send(createApiResponse(result));
    } catch (err) {
      return reply.status(401).send(createErrorResponse('Invalid email or password'));
    }
  });

  app.post('/magic-link', async (request, reply) => {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(createErrorResponse('Valid email required'));
    }
    try {
      await magicLinkService.sendMagicLink(parsed.data.email);
      return reply.status(200).send(createApiResponse({ sent: true }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send magic link';
      const status = msg.includes('Too many') ? 429 : 400;
      return reply.status(status).send(createErrorResponse(msg));
    }
  });

  app.post('/verify-magic-link', async (request, reply) => {
    const schema = z.object({ token: z.string().min(1) });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(createErrorResponse('Token required'));
    }
    try {
      const result = await magicLinkService.verifyMagicLink(parsed.data.token);
      return reply.status(200).send(createApiResponse(result));
    } catch (err) {
      return reply.status(401).send(createErrorResponse('Invalid or expired magic link'));
    }
  });

  app.post('/validate-key', async (request, reply) => {
    const body = request.body as { key?: string } | undefined;
    if (!body?.key) {
      return reply.status(400).send(createErrorResponse('API key required'));
    }
    const apiKeyService = decorated.apiKeyService;
    const userId = await apiKeyService.validateKey(body.key);
    if (!userId) {
      return reply.status(401).send(createErrorResponse('Invalid API key'));
    }
    return reply.status(200).send(createApiResponse({ userId }));
  });

  app.post('/refresh', async (request, reply) => {
    const body = request.body as Record<string, unknown> | undefined;
    const refreshToken = body?.refreshToken;
    if (typeof refreshToken !== 'string') {
      return reply.status(400).send(createErrorResponse('Refresh token required'));
    }
    try {
      const result = await authService.refreshToken(refreshToken);
      return reply.status(200).send(createApiResponse(result));
    } catch (err) {
      return reply.status(401).send(createErrorResponse('Invalid or expired refresh token'));
    }
  });
};
