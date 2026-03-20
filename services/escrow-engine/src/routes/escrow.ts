import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import type { EscrowService } from '../services/escrow-service.js';
import type { DisputeService } from '../services/dispute-service.js';

const disputeSchema = z.object({
  reason: z.string().min(1).max(1000),
  evidence: z.string().max(10000).optional(),
});

const lockSchema = z.object({
  taskId: z.string().min(1),
  fromWalletId: z.string().uuid(),
  toWalletId: z.string().uuid(),
  amount: z.string()
    .refine(val => /^\d+(\.\d{1,6})?$/.test(val), 'Amount must be a valid number')
    .refine(val => parseFloat(val) > 0, 'Amount must be positive')
    .refine(val => parseFloat(val) <= 1_000_000, 'Amount exceeds maximum'),
  deadline: z.string().datetime().optional(),
});

export const escrowRoutes: FastifyPluginAsync = async (app) => {
  const service = (app as any).escrowService as EscrowService;
  const disputeService = (app as any).disputeService as DisputeService;

  app.post('/lock', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));
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
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));
    const { escrowId } = request.params as { escrowId: string };
    try {
      const result = await service.releaseEscrow(escrowId);
      return reply.status(200).send(createApiResponse(result));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Release failed'));
    }
  });

  app.post('/:escrowId/refund', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));
    const { escrowId } = request.params as { escrowId: string };
    try {
      const result = await service.refundEscrow(escrowId);
      return reply.status(200).send(createApiResponse(result));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Refund failed'));
    }
  });

  app.post('/:escrowId/dispute', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));
    const { escrowId } = request.params as { escrowId: string };
    const parsed = disputeSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse('Invalid dispute request'));
    try {
      const result = await service.disputeEscrow(escrowId, parsed.data.reason);
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

  app.post('/:escrowId/evidence', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));
    const { escrowId } = request.params as { escrowId: string };
    const evidenceSchema = z.object({
      evidence: z.string().min(1).max(10000),
      submittedBy: z.string().min(1).max(200),
    });
    const parsed = evidenceSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse('Invalid evidence request'));
    try {
      await disputeService.submitEvidence(escrowId, parsed.data.submittedBy, parsed.data.evidence);
      return reply.status(200).send(createApiResponse({ submitted: true }));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Evidence submission failed'));
    }
  });

  app.post('/:escrowId/resolve', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));
    const userRole = (request as any).userRole;
    if (userRole !== 'admin') return reply.status(403).send(createErrorResponse('Admin role required'));
    const { escrowId } = request.params as { escrowId: string };
    const resolveSchema = z.object({
      decision: z.enum(['release_to_agent', 'refund_to_orchestrator']),
      reason: z.string().min(1),
      resolvedBy: z.string().min(1),
    });
    const parsed = resolveSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse('Invalid resolve request'));
    try {
      await disputeService.resolveDispute(escrowId, parsed.data.decision, parsed.data.resolvedBy, parsed.data.reason);
      return reply.status(200).send(createApiResponse({ resolved: true, decision: parsed.data.decision }));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Resolution failed'));
    }
  });
};
