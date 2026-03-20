import Fastify from 'fastify';
import cors from '@fastify/cors';
import { SERVICE_PORTS, createDbConnection, EventBus } from '@agntly/shared';
import { healthRoutes } from './routes/health.js';
import { webhookRoutes } from './routes/webhooks.js';
import { WebhookRepository } from './repositories/webhook-repository.js';
import { DeliveryService } from './services/delivery-service.js';

const db = createDbConnection();
const eventBus = new EventBus('webhook-service');
const webhookRepo = new WebhookRepository(db);
const deliveryService = new DeliveryService(webhookRepo);

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

app.decorate('webhookRepo', webhookRepo);
app.decorate('deliveryService', deliveryService);

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(webhookRoutes, { prefix: '/v1/webhooks' });

// Subscribe to ALL events on the Redis Stream and fan out to matching subscriptions
await eventBus.subscribe(async (message) => {
  const subscriptions = await webhookRepo.findActiveSubscriptionsByEvent(message.type);
  for (const sub of subscriptions) {
    try {
      await deliveryService.deliver(sub, {
        id: message.id,
        type: message.type,
        data: message.data,
        timestamp: message.timestamp,
      });
    } catch (err) {
      app.log.error({ err, subscriptionId: sub.id, eventId: message.id }, 'Webhook delivery failed');
    }
  }
});

// Retry loop: process pending retries every 30 seconds
setInterval(() => deliveryService.processRetries().catch(err => app.log.error(err)), 30_000);

const port = SERVICE_PORTS.webhook;
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`webhook-service running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
