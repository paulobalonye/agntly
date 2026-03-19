import Fastify from 'fastify';
import cors from '@fastify/cors';
import { SERVICE_PORTS } from '@agntly/shared';
import { healthRoutes } from './routes/health.js';
import { webhookRoutes } from './routes/webhooks.js';

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(webhookRoutes, { prefix: '/v1/webhooks' });

const port = SERVICE_PORTS.webhook;
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`webhook-service running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
