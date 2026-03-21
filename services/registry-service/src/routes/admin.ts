import type { FastifyPluginAsync } from 'fastify';
import { sql } from 'drizzle-orm';
import { createApiResponse, createErrorResponse, createDbConnection } from '@agntly/shared';
import type { RegistryService } from '../services/registry-service.js';

export const adminAgentRoutes: FastifyPluginAsync = async (app) => {
  const db = createDbConnection();
  const registryService = (app as any).registryService as RegistryService;

  // GET /agents/stats — Agent statistics
  app.get('/agents/stats', async (_request, reply) => {
    try {
      const totalResult = await db.execute(
        sql`SELECT COUNT(*)::int AS total_agents FROM agents`
      );
      const activeResult = await db.execute(
        sql`SELECT COUNT(*)::int AS active_agents FROM agents WHERE status = 'active'`
      );
      const categoryResult = await db.execute(
        sql`SELECT category, COUNT(*)::int AS count FROM agents GROUP BY category`
      );

      const totalAgents = totalResult.rows[0]?.total_agents ?? 0;
      const activeAgents = activeResult.rows[0]?.active_agents ?? 0;

      const agentsByCategory: Record<string, number> = {};
      for (const row of categoryResult.rows) {
        const category = row.category as string;
        agentsByCategory[category] = row.count as number;
      }

      return reply.status(200).send(createApiResponse({
        totalAgents,
        activeAgents,
        agentsByCategory,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get agent stats';
      return reply.status(500).send(createErrorResponse(message));
    }
  });

  // POST /agents/health-check — Trigger health check on all agents
  app.post('/agents/health-check', async (_request, reply) => {
    try {
      const result = await registryService.checkAllAgentsHealth();
      return reply.status(200).send(createApiResponse(result));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Health check failed';
      return reply.status(500).send(createErrorResponse(message));
    }
  });

  // GET /agents/health — Get agents with low uptime
  app.get('/agents/health', async (_request, reply) => {
    try {
      const result = await db.execute(
        sql`SELECT id, name, endpoint, status, uptime_pct, updated_at
            FROM agents
            WHERE status != 'delisted'
            ORDER BY uptime_pct ASC
            LIMIT 20`
      );
      return reply.status(200).send(createApiResponse(result.rows));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get agent health';
      return reply.status(500).send(createErrorResponse(message));
    }
  });
};
