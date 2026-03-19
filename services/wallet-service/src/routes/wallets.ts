import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse, createDbConnection } from '@agntly/shared';
import { WalletService } from '../services/wallet-service.js';
import { WalletRepository } from '../repositories/wallet-repository.js';

const createSchema = z.object({ agentId: z.string().min(1).optional(), label: z.string().optional() });
const fundSchema = z.object({ amountUsd: z.number().positive(), method: z.enum(['card', 'ach', 'usdc']) });
const withdrawSchema = z.object({ amount: z.string(), destination: z.string(), instant: z.boolean().optional() });

export const walletRoutes: FastifyPluginAsync = async (app) => {
  const db = createDbConnection();
  const walletService = new WalletService(new WalletRepository(db));

  app.post('/', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse('Invalid input'));
    const wallet = await walletService.createWallet('demo-user', parsed.data.agentId);
    return reply.status(201).send(createApiResponse(wallet));
  });

  app.get('/:walletId', async (request, reply) => {
    const { walletId } = request.params as { walletId: string };
    const wallet = await walletService.getWallet(walletId);
    if (!wallet) return reply.status(404).send(createErrorResponse('Wallet not found'));
    return reply.status(200).send(createApiResponse(wallet));
  });

  app.post('/:walletId/fund', async (request, reply) => {
    const { walletId } = request.params as { walletId: string };
    const parsed = fundSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse('Invalid funding request'));
    const result = await walletService.fundWallet(walletId, parsed.data.amountUsd, parsed.data.method);
    return reply.status(200).send(createApiResponse(result));
  });

  app.post('/:walletId/withdraw', async (request, reply) => {
    const { walletId } = request.params as { walletId: string };
    const parsed = withdrawSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse('Invalid withdrawal request'));
    const result = await walletService.withdraw(walletId, parsed.data.amount, parsed.data.destination, parsed.data.instant);
    return reply.status(200).send(createApiResponse(result));
  });
};
