import Fastify from 'fastify';
import cors from '@fastify/cors';
import { SERVICE_PORTS } from '@agntly/shared';
import { healthRoutes } from './routes/health.js';
import { paymentRoutes } from './routes/payments.js';

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(paymentRoutes, { prefix: '/v1/payments' });

const port = SERVICE_PORTS.payment;
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`payment-service running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
