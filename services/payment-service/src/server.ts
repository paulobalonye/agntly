import Fastify from 'fastify';
import cors from '@fastify/cors';
import { SERVICE_PORTS, createDbConnection, createPool, EventBus } from '@agntly/shared';
import { healthRoutes } from './routes/health.js';
import { paymentRoutes } from './routes/payments.js';
import { webhookRoutes } from './routes/webhook.js';
import { adminPaymentRoutes } from './routes/admin.js';
import { PaymentRepository } from './repositories/payment-repository.js';
import { PaymentService } from './services/payment-service.js';
import { StripeClient } from './services/stripe-client.js';
import { WalletRepository } from '@agntly/wallet-service/repositories/wallet-repository';

// Two separate pools: Drizzle uses one for ORM queries,
// raw pg pool is used for cross-table transactions (handleWebhook).
const db = createDbConnection();
const pool = createPool();
const eventBus = new EventBus('payment-service');
const stripeClient = new StripeClient();

const paymentRepo = new PaymentRepository(db);
const walletRepo = new WalletRepository(db);
const paymentService = new PaymentService(paymentRepo, walletRepo, stripeClient, pool, eventBus);

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

// Decorate app so route plugins can access the service
app.decorate('paymentService', paymentService);

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(paymentRoutes, { prefix: '/v1/payments' });
// Webhook is a separate plugin for raw body parser scoping
await app.register(webhookRoutes, { prefix: '/v1/payments' });
await app.register(adminPaymentRoutes, { prefix: '/v1/admin' });

const port = SERVICE_PORTS.payment;
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`payment-service running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
