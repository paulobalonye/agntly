import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import type { PolicyService } from '../services/policy-service.js';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  perTransactionMax: z.string().optional(),
  dailyBudget: z.string().optional(),
  monthlyBudget: z.string().optional(),
  lifetimeBudget: z.string().optional(),
  allowedCategories: z.array(z.string()).optional(),
  blockedAgentIds: z.array(z.string()).optional(),
  maxPricePerCall: z.string().optional(),
  verifiedOnly: z.boolean().optional(),
  cooldownSeconds: z.number().int().min(0).max(3600).optional(),
});

export const policyRoutes: FastifyPluginAsync = async (app) => {
  const policyService = (app as any).policyService as PolicyService;

  // POST / — Create a spending policy
  app.post('/', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(createErrorResponse(parsed.error.issues[0]?.message ?? 'Invalid input'));
    }

    try {
      const policy = await policyService.createPolicy(userId, parsed.data);
      return reply.status(201).send(createApiResponse(policy));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Failed to create policy'));
    }
  });

  // GET / — List user's policies
  app.get('/', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));

    const policies = await policyService.listPolicies(userId);
    return reply.status(200).send(createApiResponse(policies));
  });

  // GET /:id — Get policy details
  app.get('/:policyId', async (request, reply) => {
    const { policyId } = request.params as { policyId: string };
    const policy = await policyService.getPolicy(policyId);
    if (!policy) return reply.status(404).send(createErrorResponse('Policy not found'));
    return reply.status(200).send(createApiResponse(policy));
  });

  // PUT /:id — Update policy
  app.put('/:policyId', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));
    const { policyId } = request.params as { policyId: string };

    const policy = await policyService.updatePolicy(policyId, userId, request.body as Record<string, unknown>);
    if (!policy) return reply.status(403).send(createErrorResponse('Policy not found or not owned by you'));
    return reply.status(200).send(createApiResponse(policy));
  });

  // DELETE /:id — Delete policy
  app.delete('/:policyId', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));
    const { policyId } = request.params as { policyId: string };

    const deleted = await policyService.deletePolicy(policyId, userId);
    if (!deleted) return reply.status(403).send(createErrorResponse('Policy not found or not owned by you'));
    return reply.status(200).send(createApiResponse({ deleted: true }));
  });
};
