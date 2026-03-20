import Fastify from 'fastify';
import cors from '@fastify/cors';
import { SERVICE_PORTS } from '@agntly/shared';
import { healthRoutes } from './routes/health.js';
import { agentRoutes } from './routes/agents.js';
import { badgeRoutes } from './routes/badge.js';
import { adminAgentRoutes } from './routes/admin.js';

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(agentRoutes, { prefix: '/v1/agents' });
await app.register(badgeRoutes, { prefix: '/v1/agents' });
await app.register(adminAgentRoutes, { prefix: '/v1/admin' });

const port = SERVICE_PORTS.registry;
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`registry-service running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
