import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { isAddress } from 'viem';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import type { WalletService } from '../services/wallet-service.js';

const createSchema = z.object({
  agentId: z.string().min(1).optional(),
  label: z.string().optional(),
});

const fundSchema = z.object({
  amountUsd: z.number().positive(),
  method: z.enum(['card', 'ach', 'usdc']),
});

const withdrawSchema = z.object({
  amount: z.string()
    .refine(val => /^\d+(\.\d{1,6})?$/.test(val), 'Amount must be a positive number with up to 6 decimal places')
    .refine(val => parseFloat(val) > 0, 'Amount must be greater than zero'),
  destination: z.string()
    .refine(val => isAddress(val, { strict: true }), 'Invalid Ethereum address (EIP-55 checksum required)')
    .refine(val => val !== '0x0000000000000000000000000000000000000000', 'Cannot withdraw to zero address'),
});

const historySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const walletRoutes: FastifyPluginAsync = async (app) => {
  const service = (app as any).walletService as WalletService;

  app.post('/', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse('Invalid input'));
    const userId = (request as any).userId ?? 'demo-user';
    const wallet = await service.createWallet(userId, parsed.data.agentId);
    return reply.status(201).send(createApiResponse(wallet));
  });

  app.get('/:walletId', async (request, reply) => {
    const { walletId } = request.params as { walletId: string };
    const wallet = await service.getWallet(walletId);
    if (!wallet) return reply.status(404).send(createErrorResponse('Wallet not found'));
    return reply.status(200).send(createApiResponse(wallet));
  });

  app.post('/:walletId/fund', async (request, reply) => {
    const { walletId } = request.params as { walletId: string };
    const parsed = fundSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse('Invalid funding request'));
    try {
      const result = await service.fundWallet(walletId, parsed.data.amountUsd, parsed.data.method);
      return reply.status(200).send(createApiResponse(result));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Funding failed'));
    }
  });

  app.post('/:walletId/withdraw', async (request, reply) => {
    const { walletId } = request.params as { walletId: string };
    const parsed = withdrawSchema.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid withdrawal request';
      return reply.status(400).send(createErrorResponse(msg));
    }
    const userId = (request as any).userId ?? 'demo-user';
    try {
      const result = await service.withdraw(userId, walletId, parsed.data.amount, parsed.data.destination);
      return reply.status(202).send(createApiResponse(result));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Withdrawal failed';
      const status = message.includes('does not belong') ? 403 : 400;
      return reply.status(status).send(createErrorResponse(message));
    }
  });

  // GET /:walletId/withdrawals — Withdrawal history
  app.get('/:walletId/withdrawals', async (request, reply) => {
    const { walletId } = request.params as { walletId: string };
    const parsed = historySchema.safeParse(request.query);
    const { limit, offset } = parsed.success ? parsed.data : { limit: 20, offset: 0 };
    try {
      const result = await service.getWithdrawalHistory(walletId, limit, offset);
      return reply.status(200).send({
        success: true,
        data: result.withdrawals,
        error: null,
        meta: { total: result.total, limit: result.limit, offset: result.offset },
      });
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Failed to get history'));
    }
  });
};
