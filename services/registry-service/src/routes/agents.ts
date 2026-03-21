import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import type { RegistryService } from '../services/registry-service.js';

const registerSchema = z.object({
  agentId: z.string().min(1), name: z.string().min(1), description: z.string(),
  endpoint: z.string().url(), priceUsdc: z.string(), category: z.string(),
  tags: z.array(z.string()).optional(), timeoutMs: z.number().optional(),
});

export const agentRoutes: FastifyPluginAsync = async (app) => {
  const registryService = (app as any).registryService as RegistryService;

  app.post('/', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse(parsed.error.issues[0]?.message ?? 'Invalid input'));
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));
    const agent = await registryService.registerAgent(userId, parsed.data);
    return reply.status(201).send(createApiResponse(agent));
  });

  app.get('/', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const agents = await registryService.listAgents(query);
    return reply.status(200).send(createApiResponse(agents));
  });

  app.get('/:agentId', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const agent = await registryService.getAgent(agentId);
    if (!agent) return reply.status(404).send(createErrorResponse('Agent not found'));
    return reply.status(200).send(createApiResponse(agent));
  });

  app.put('/:agentId', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));
    const { agentId } = request.params as { agentId: string };
    const updates = request.body as Record<string, unknown>;
    const agent = await registryService.updateAgent(agentId, updates);
    return reply.status(200).send(createApiResponse(agent));
  });

  app.delete('/:agentId', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));
    const { agentId } = request.params as { agentId: string };
    await registryService.delistAgent(agentId);
    return reply.status(200).send(createApiResponse({ delisted: true }));
  });
};
