import Fastify from 'fastify';
import cors from '@fastify/cors';
import { SERVICE_PORTS } from '@agntly/shared';
import { healthRoutes } from './routes/health.js';
import { escrowRoutes } from './routes/escrow.js';

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(escrowRoutes, { prefix: '/v1/escrow' });

const port = SERVICE_PORTS.escrow;
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`escrow-engine running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
