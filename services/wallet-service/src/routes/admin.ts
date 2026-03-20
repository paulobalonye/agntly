import type { FastifyPluginAsync } from 'fastify';
import { sql } from 'drizzle-orm';
import { createApiResponse, createErrorResponse, createDbConnection } from '@agntly/shared';

export const adminWalletRoutes: FastifyPluginAsync = async (app) => {
  const db = createDbConnection();

  // GET /wallets/stats — Wallet aggregate statistics
  app.get('/wallets/stats', async (_request, reply) => {
    try {
      const result = await db.execute(
        sql`SELECT
              COUNT(*)::int AS total_wallets,
              COALESCE(SUM(balance::numeric), 0)::text AS total_balance,
              COALESCE(SUM(locked::numeric), 0)::text AS total_locked
            FROM wallets`
      );

      const row = result.rows[0];

      return reply.status(200).send(createApiResponse({
        totalWallets: row?.total_wallets ?? 0,
        totalBalance: row?.total_balance ?? '0',
        totalLocked: row?.total_locked ?? '0',
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get wallet stats';
      return reply.status(500).send(createErrorResponse(message));
    }
  });
};
