import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import { ApiKeyService } from '../services/api-key-service.js';

const createKeySchema = z.object({ label: z.string().min(1).max(100) });

export const apiKeyRoutes: FastifyPluginAsync = async (app) => {
  const apiKeyService = new ApiKeyService();

  app.post('/', async (request, reply) => {
    const parsed = createKeySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse('Label is required'));

    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));

    const result = await apiKeyService.createKey(userId, parsed.data.label);
    return reply.status(201).send(createApiResponse(result));
  });

  app.get('/', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));

    const keys = await apiKeyService.listKeys(userId);
    return reply.status(200).send(createApiResponse(keys));
  });

  app.delete('/:keyId', async (request, reply) => {
    const userId = (request as any).userId;
    const { keyId } = request.params as { keyId: string };
    await apiKeyService.revokeKey(userId, keyId);
    return reply.status(200).send(createApiResponse({ revoked: true }));
  });
};
