import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import type { RegistryService } from '../services/registry-service.js';

const registerSchema = z.object({
  agentId: z.string().min(1), name: z.string().min(1), description: z.string(),
  endpoint: z.string().url(), priceUsdc: z.string(), category: z.string(),
  tags: z.array(z.string()).optional(), timeoutMs: z.number().optional(),
});

const WALLET_URL = process.env.WALLET_SERVICE_URL ?? 'http://localhost:3002';

export const agentRoutes: FastifyPluginAsync = async (app) => {
  const registryService = (app as any).registryService as RegistryService;

  app.post('/', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse(parsed.error.issues[0]?.message ?? 'Invalid input'));
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));

    // Resolve owner's real wallet so every agent points to an actual wallet-service record.
    // All agents owned by the same user share one wallet — earnings consolidate there.
    // Autonomous agents (registered via register-simple) each have their own user account
    // and therefore their own wallet, giving them full financial independence.
    let walletId: string | undefined;
    try {
      const getRes = await fetch(`${WALLET_URL}/v1/wallets`, {
        headers: { 'x-user-id': userId },
      });
      if (getRes.ok) {
        const json = await getRes.json() as { data?: { id?: string } };
        walletId = json?.data?.id;
      }
      if (!walletId) {
        // No wallet yet — auto-create one for this user
        const createRes = await fetch(`${WALLET_URL}/v1/wallets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
          body: JSON.stringify({}),
        });
        if (createRes.ok) {
          const json = await createRes.json() as { data?: { id?: string } };
          walletId = json?.data?.id;
        }
      }
    } catch {
      // Wallet service unavailable — registration proceeds with a placeholder walletId.
      // Escrow will fall back to sandbox mode until the agent re-registers or wallet is linked.
    }

    const agent = await registryService.registerAgent(userId, { ...parsed.data, walletId });
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
    const existing = await registryService.getAgent(agentId);
    if (!existing) return reply.status(404).send(createErrorResponse('Agent not found'));
    if (existing.ownerId !== userId) return reply.status(403).send(createErrorResponse('You can only modify your own agents'));
    const updates = request.body as Record<string, unknown>;
    const agent = await registryService.updateAgent(agentId, updates);
    return reply.status(200).send(createApiResponse(agent));
  });

  app.delete('/:agentId', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));
    const { agentId } = request.params as { agentId: string };
    const existing = await registryService.getAgent(agentId);
    if (!existing) return reply.status(404).send(createErrorResponse('Agent not found'));
    if (existing.ownerId !== userId) return reply.status(403).send(createErrorResponse('You can only delete your own agents'));
    await registryService.delistAgent(agentId);
    return reply.status(200).send(createApiResponse({ delisted: true }));
  });

  // POST /:agentId/stats — internal endpoint called by task-service on task completion
  app.post('/:agentId/stats', async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const body = request.body as { latencyMs?: number | null };
    try {
      await registryService.recordTaskCompletion(agentId, body.latencyMs ?? null);
      return reply.status(200).send(createApiResponse({ updated: true }));
    } catch {
      return reply.status(404).send(createErrorResponse('Agent not found'));
    }
  });
};
