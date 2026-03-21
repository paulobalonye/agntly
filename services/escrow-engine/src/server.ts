import Fastify from 'fastify';
import cors from '@fastify/cors';
import { SERVICE_PORTS, createDbConnection, EventBus } from '@agntly/shared';
import { healthRoutes } from './routes/health.js';
import { escrowRoutes } from './routes/escrow.js';
import { EscrowRepository } from './repositories/escrow-repository.js';
import { EscrowService } from './services/escrow-service.js';
import { DisputeService } from './services/dispute-service.js';

const db = createDbConnection();
const eventBus = new EventBus('escrow-engine');
const escrowRepo = new EscrowRepository(db);
const escrowService = new EscrowService(escrowRepo, eventBus);
const disputeService = new DisputeService(escrowRepo, eventBus);

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

app.decorate('escrowService', escrowService);
app.decorate('disputeService', disputeService);

app.addHook('preHandler', async (request) => {
  const userId = request.headers['x-user-id'];
  if (typeof userId === 'string' && userId.length > 0) {
    (request as any).userId = userId;
  }
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
