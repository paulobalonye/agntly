import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import type { FiatService } from '../services/fiat-service.js';

const withdrawSchema = z.object({
  amountUsd: z.number().positive().min(10, 'Minimum withdrawal is $10'),
});

export const fiatRoutes: FastifyPluginAsync = async (app) => {
  const fiatService = (app as any).fiatService as FiatService;

  // POST /bank-account — Create a bank account (requires KYC)
  app.post('/bank-account', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));

    try {
      const account = await fiatService.createBankAccount(userId);
      return reply.status(201).send(createApiResponse(account));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Failed to create bank account'));
    }
  });

  // GET /bank-account — Get user's bank account
  app.get('/bank-account', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));

    const account = await fiatService.getBankAccount(userId);
    if (!account) {
      return reply.status(404).send(createErrorResponse('No bank account linked. Complete KYC and create one.'));
    }
    return reply.status(200).send(createApiResponse(account));
  });

  // POST /withdraw — Withdraw USD to bank account via ACH
  app.post('/withdraw', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));

    const parsed = withdrawSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(createErrorResponse(parsed.error.issues[0]?.message ?? 'Invalid amount'));
    }

    try {
      const transfer = await fiatService.withdrawUsd(userId, parsed.data.amountUsd);
      return reply.status(202).send(createApiResponse(transfer));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Withdrawal failed'));
    }
  });

  // GET /transfers — Get fiat transfer history
  app.get('/transfers', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));

    const transfers = await fiatService.getTransferHistory(userId);
    return reply.status(200).send(createApiResponse(transfers));
  });

  // GET /stats — Admin: fiat stats
  app.get('/stats', async (_request, reply) => {
    try {
      const stats = await fiatService.getStats();
      return reply.status(200).send(createApiResponse(stats));
    } catch (err) {
      return reply.status(500).send(createErrorResponse(err instanceof Error ? err.message : 'Failed to get stats'));
    }
  });
};
