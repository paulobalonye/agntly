import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse, createDbConnection } from '@agntly/shared';
import { EscrowService } from '../services/escrow-service.js';
import { EscrowRepository } from '../repositories/escrow-repository.js';

const lockSchema = z.object({ taskId: z.string(), fromWalletId: z.string(), toWalletId: z.string(), amount: z.string() });

export const escrowRoutes: FastifyPluginAsync = async (app) => {
  const db = createDbConnection();
  const escrowService = new EscrowService(new EscrowRepository(db));

  app.post('/lock', async (request, reply) => {
    const parsed = lockSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse('Invalid escrow request'));
    try {
      const escrow = await escrowService.lockEscrow(parsed.data);
      return reply.status(201).send(createApiResponse(escrow));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Lock failed'));
    }
  });

  app.post('/:escrowId/release', async (request, reply) => {
    const { escrowId } = request.params as { escrowId: string };
    try {
      const result = await escrowService.releaseEscrow(escrowId);
      return reply.status(200).send(createApiResponse(result));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Release failed'));
    }
  });

  app.post('/:escrowId/refund', async (request, reply) => {
    const { escrowId } = request.params as { escrowId: string };
    try {
      const result = await escrowService.refundEscrow(escrowId);
      return reply.status(200).send(createApiResponse(result));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Refund failed'));
    }
  });

  app.post('/:escrowId/dispute', async (request, reply) => {
    const { escrowId } = request.params as { escrowId: string };
    const body = request.body as { reason: string; evidence?: string };
    try {
      const result = await escrowService.disputeEscrow(escrowId, body.reason);
      return reply.status(200).send(createApiResponse(result));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Dispute failed'));
    }
  });

  app.get('/:escrowId', async (request, reply) => {
    const { escrowId } = request.params as { escrowId: string };
    const escrow = await escrowService.getEscrow(escrowId);
    if (!escrow) return reply.status(404).send(createErrorResponse('Escrow not found'));
    return reply.status(200).send(createApiResponse(escrow));
  });
};
