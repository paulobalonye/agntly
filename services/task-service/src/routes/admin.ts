import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { createApiResponse, createErrorResponse, createDbConnection } from '@agntly/shared';

const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const adminTaskRoutes: FastifyPluginAsync = async (app) => {
  const db = createDbConnection();

  // GET /tasks — List recent tasks with pagination
  app.get('/tasks', async (request, reply) => {
    const parsed = paginationSchema.safeParse(request.query);
    const { limit, offset } = parsed.success ? parsed.data : { limit: 20, offset: 0 };

    try {
      const tasksResult = await db.execute(
        sql`SELECT id, orchestrator_id, agent_id, status, amount, created_at, completed_at
            FROM tasks
            ORDER BY created_at DESC
            LIMIT ${limit} OFFSET ${offset}`
      );
      const countResult = await db.execute(
        sql`SELECT COUNT(*)::int AS total FROM tasks`
      );

      const total = countResult.rows[0]?.total ?? 0;

      return reply.status(200).send({
        success: true,
        data: tasksResult.rows,
        error: null,
        meta: { total, limit, offset },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list tasks';
      return reply.status(500).send(createErrorResponse(message));
    }
  });

  // GET /tasks/stats — Task statistics
  app.get('/tasks/stats', async (_request, reply) => {
    try {
      const totalResult = await db.execute(
        sql`SELECT COUNT(*)::int AS total FROM tasks`
      );
      const statusResult = await db.execute(
        sql`SELECT status, COUNT(*)::int AS count FROM tasks GROUP BY status`
      );
      const todayResult = await db.execute(
        sql`SELECT COUNT(*)::int AS total FROM tasks WHERE created_at >= CURRENT_DATE`
      );

      const totalTasks = totalResult.rows[0]?.total ?? 0;
      const tasksToday = todayResult.rows[0]?.total ?? 0;

      const tasksByStatus: Record<string, number> = {};
      for (const row of statusResult.rows) {
        const status = row.status as string;
        tasksByStatus[status] = row.count as number;
      }

      return reply.status(200).send(createApiResponse({
        totalTasks,
        tasksByStatus,
        tasksToday,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get task stats';
      return reply.status(500).send(createErrorResponse(message));
    }
  });
};
