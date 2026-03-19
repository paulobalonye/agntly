import Fastify from 'fastify';
import cors from '@fastify/cors';
import { SERVICE_PORTS } from '@agntly/shared';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { apiKeyRoutes } from './routes/api-keys.js';

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(authRoutes, { prefix: '/v1/auth' });
    await app.register(apiKeyRoutes, { prefix: '/v1/api-keys' });

const port = SERVICE_PORTS.auth;
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`auth-service running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
