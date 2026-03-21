import Fastify from 'fastify';
import cors from '@fastify/cors';
import { SERVICE_PORTS, createDbConnection } from '@agntly/shared';
import { healthRoutes } from './routes/health.js';
import { agentRoutes } from './routes/agents.js';
import { badgeRoutes } from './routes/badge.js';
import { adminAgentRoutes } from './routes/admin.js';
import { RegistryService } from './services/registry-service.js';

const db = createDbConnection();
const registryService = new RegistryService(db);

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

app.decorate('registryService', registryService);

app.addHook('preHandler', async (request) => {
  const userId = request.headers['x-user-id'];
  if (typeof userId === 'string' && userId.length > 0) {
    (request as any).userId = userId;
  }
});

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(agentRoutes, { prefix: '/v1/agents' });
await app.register(badgeRoutes, { prefix: '/v1/agents' });
await app.register(adminAgentRoutes, { prefix: '/v1/admin' });

const port = SERVICE_PORTS.registry;
const host = process.env.HOST ?? '0.0.0.0';

try {
  // Seed demo agents on startup (idempotent)
  await registryService.seedDemoAgents();
  app.log.info('Demo agents seeded');

  await app.listen({ port, host });
  app.log.info(`registry-service running on ${host}:${port}`);

  // Periodic health checks — every 5 minutes
  const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;
  setInterval(async () => {
    try {
      const result = await registryService.checkAllAgentsHealth();
      app.log.info(
        `[health-check] Checked ${result.checked} agents: ${result.healthy} healthy, ${result.unhealthy} unhealthy`,
      );
    } catch (err) {
      app.log.error({ err }, '[health-check] Failed to run health checks');
    }
  }, HEALTH_CHECK_INTERVAL);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
