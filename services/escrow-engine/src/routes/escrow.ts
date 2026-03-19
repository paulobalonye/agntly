import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import type { EscrowService } from '../services/escrow-service.js';

const lockSchema = z.object({
  taskId: z.string(),
  fromWalletId: z.string(),
  toWalletId: z.string(),
  amount: z.string(),
  deadline: z.string().datetime().optional(),
});

export const escrowRoutes: FastifyPluginAsync = async (app) => {
  const service = (app as any).escrowService as EscrowService;

  app.post('/lock', async (request, reply) => {
    const parsed = lockSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse('Invalid escrow request'));
    try {
      const params = {
        taskId: parsed.data.taskId,
        fromWalletId: parsed.data.fromWalletId,
        toWalletId: parsed.data.toWalletId,
        amount: parsed.data.amount,
        ...(parsed.data.deadline !== undefined ? { deadline: new Date(parsed.data.deadline) } : {}),
      };
      const escrow = await service.lockEscrow(params);
      return reply.status(201).send(createApiResponse(escrow));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Lock failed'));
    }
  });

  app.post('/:escrowId/release', async (request, reply) => {
    const { escrowId } = request.params as { escrowId: string };
    try {
      const result = await service.releaseEscrow(escrowId);
      return reply.status(200).send(createApiResponse(result));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Release failed'));
    }
  });

  app.post('/:escrowId/refund', async (request, reply) => {
    const { escrowId } = request.params as { escrowId: string };
    try {
      const result = await service.refundEscrow(escrowId);
      return reply.status(200).send(createApiResponse(result));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Refund failed'));
    }
  });

  app.post('/:escrowId/dispute', async (request, reply) => {
    const { escrowId } = request.params as { escrowId: string };
    const body = request.body as { reason: string; evidence?: string };
    try {
      const result = await service.disputeEscrow(escrowId, body.reason);
      return reply.status(200).send(createApiResponse(result));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Dispute failed'));
    }
  });

  app.get('/:escrowId', async (request, reply) => {
    const { escrowId } = request.params as { escrowId: string };
    const escrow = await service.getEscrow(escrowId);
    if (!escrow) return reply.status(404).send(createErrorResponse('Escrow not found'));
    return reply.status(200).send(createApiResponse(escrow));
  });
};
