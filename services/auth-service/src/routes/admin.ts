import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { createApiResponse, createErrorResponse, createDbConnection } from '@agntly/shared';

const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const adminUserRoutes: FastifyPluginAsync = async (app) => {
  const db = createDbConnection();

  // GET /users — List all users with pagination
  app.get('/users', async (request, reply) => {
    const parsed = paginationSchema.safeParse(request.query);
    const { limit, offset } = parsed.success ? parsed.data : { limit: 20, offset: 0 };

    try {
      const usersResult = await db.execute(
        sql`SELECT id, email, role, created_at FROM users ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
      );
      const countResult = await db.execute(
        sql`SELECT COUNT(*)::int AS total FROM users`
      );

      const total = countResult.rows[0]?.total ?? 0;

      return reply.status(200).send({
        success: true,
        data: usersResult.rows,
        error: null,
        meta: { total, limit, offset },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list users';
      return reply.status(500).send(createErrorResponse(message));
    }
  });

  // GET /users/stats — User statistics
  app.get('/users/stats', async (_request, reply) => {
    try {
      const totalResult = await db.execute(
        sql`SELECT COUNT(*)::int AS total FROM users`
      );
      const todayResult = await db.execute(
        sql`SELECT COUNT(*)::int AS total FROM users WHERE created_at >= CURRENT_DATE`
      );
      const roleResult = await db.execute(
        sql`SELECT role, COUNT(*)::int AS count FROM users GROUP BY role`
      );

      const totalUsers = totalResult.rows[0]?.total ?? 0;
      const usersToday = todayResult.rows[0]?.total ?? 0;

      const usersByRole: Record<string, number> = {};
      for (const row of roleResult.rows) {
        const role = row.role as string;
        usersByRole[role] = row.count as number;
      }

      return reply.status(200).send(createApiResponse({
        totalUsers,
        usersToday,
        usersByRole,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get user stats';
      return reply.status(500).send(createErrorResponse(message));
    }
  });
};
