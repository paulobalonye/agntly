import Fastify from 'fastify';
import cors from '@fastify/cors';
import { SERVICE_PORTS } from '@agntly/shared';
import { healthRoutes } from './routes/health.js';
import { taskRoutes } from './routes/tasks.js';

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(taskRoutes, { prefix: '/v1/tasks' });

const port = SERVICE_PORTS.task;
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`task-service running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
