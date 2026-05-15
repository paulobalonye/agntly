import Fastify from 'fastify';
import cors from '@fastify/cors';
import IORedis from 'ioredis';
import { SERVICE_PORTS, createDbConnection, EventBus } from '@agntly/shared';
import { healthRoutes } from './routes/health.js';
import { taskRoutes } from './routes/tasks.js';
import { adminTaskRoutes } from './routes/admin.js';
import { policyRoutes } from './routes/policies.js';
import { TaskRepository } from './repositories/task-repository.js';
import { TaskService } from './services/task-service.js';
import { PolicyService } from './services/policy-service.js';

const db = createDbConnection();
const eventBus = new EventBus('task-service');
const taskRepo = new TaskRepository(db);
const taskService = new TaskService(taskRepo, eventBus);

// Redis for spend tracking
let redis: any = null;
try {
  redis = new (IORedis as any)(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
  });
  await redis.connect();
} catch {
  console.warn('[task-service] Redis unavailable for spend tracking — policies will skip budget checks');
  redis = null;
}

const policyService = new PolicyService(db, redis);

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

app.decorate('taskService', taskService);
app.decorate('policyService', policyService);

app.addHook('preHandler', async (request) => {
  const userId = request.headers['x-user-id'];
  if (typeof userId === 'string' && userId.length > 0) {
    (request as any).userId = userId;
  }
});

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(taskRoutes, { prefix: '/v1/tasks' });
await app.register(policyRoutes, { prefix: '/v1/policies' });
await app.register(adminTaskRoutes, { prefix: '/v1/admin' });

// Sweep expired tasks every 10 seconds
setInterval(() => {
  taskService.sweepExpiredTasks().catch((err) => app.log.error(err, 'Task sweep failed'));
}, 10_000);

const port = SERVICE_PORTS.task;
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`task-service running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
