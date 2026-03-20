import type { FastifyPluginAsync } from 'fastify';
import { sql } from 'drizzle-orm';
import { createApiResponse, createErrorResponse, createDbConnection } from '@agntly/shared';

export const adminPaymentRoutes: FastifyPluginAsync = async (app) => {
  const db = createDbConnection();

  // GET /payments/stats — Payment statistics
  app.get('/payments/stats', async (_request, reply) => {
    try {
      const totalResult = await db.execute(
        sql`SELECT
              COUNT(*)::int AS total_payments,
              COALESCE(SUM(amount_usd::numeric), 0)::text AS total_volume
            FROM payments`
      );
      const todayResult = await db.execute(
        sql`SELECT
              COUNT(*)::int AS payments_today,
              COALESCE(SUM(amount_usd::numeric), 0)::text AS volume_today
            FROM payments
            WHERE created_at >= CURRENT_DATE`
      );

      const totalRow = totalResult.rows[0];
      const todayRow = todayResult.rows[0];

      return reply.status(200).send(createApiResponse({
        totalPayments: totalRow?.total_payments ?? 0,
        totalVolume: totalRow?.total_volume ?? '0',
        paymentsToday: todayRow?.payments_today ?? 0,
        volumeToday: todayRow?.volume_today ?? '0',
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get payment stats';
      return reply.status(500).send(createErrorResponse(message));
    }
  });
};
