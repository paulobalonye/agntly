import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import type { WebhookRepository } from '../repositories/webhook-repository.js';
import type { DeliveryService } from '../services/delivery-service.js';

const ALL_WEBHOOK_EVENTS = [
  'task.created',
  'task.escrowed',
  'task.dispatched',
  'task.completed',
  'task.failed',
  'task.disputed',
  'escrow.locked',
  'escrow.released',
  'escrow.refunded',
  'escrow.failed',
  'escrow.dispute_opened',
  'escrow.dispute_resolved',
  'settlement.submitted',
  'settlement.confirmed',
  'settlement.failed',
  'wallet.funded',
  'wallet.withdrawn',
  'wallet.locked',
  'wallet.unlocked',
  'agent.verified',
] as const;

const createSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(16),
  events: z.array(z.enum(ALL_WEBHOOK_EVENTS)).min(1),
});

const testSchema = z.object({
  webhookId: z.string().uuid(),
});

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  const webhookRepo = (app as unknown as { webhookRepo: WebhookRepository }).webhookRepo;
  const deliveryService = (app as unknown as { deliveryService: DeliveryService }).deliveryService;

  // POST / — Create webhook subscription
  app.post('/', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(createErrorResponse('Invalid webhook config'));
    }

    const { url, secret, events } = parsed.data;
    const userId = 'demo-user';

    const subscription = await webhookRepo.createSubscription({ userId, url, secret, events });

    // Return subscription without exposing raw secret
    const { secretHash: _, ...safeSubscription } = subscription;
    return reply.status(201).send(createApiResponse(safeSubscription));
  });

  // GET / — List user's subscriptions
  app.get('/', async (request, reply) => {
    const userId = 'demo-user';
    const subscriptions = await webhookRepo.findSubscriptionsByUserId(userId);
    const safe = subscriptions.map(({ secretHash: _, ...rest }) => rest);
    return reply.status(200).send(createApiResponse(safe));
  });

  // DELETE /:webhookId — Delete subscription
  app.delete('/:webhookId', async (request, reply) => {
    const { webhookId } = request.params as { webhookId: string };
    await webhookRepo.deleteSubscription(webhookId);
    return reply.status(200).send(createApiResponse({ deleted: true }));
  });

  // POST /test — Test webhook delivery
  app.post('/test', async (request, reply) => {
    const parsed = testSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(createErrorResponse('webhookId (uuid) is required'));
    }

    const subscription = await webhookRepo.findSubscriptionById(parsed.data.webhookId);
    if (!subscription) {
      return reply.status(404).send(createErrorResponse('Subscription not found'));
    }

    const testEvent = {
      id: `evt_test_${Date.now()}`,
      type: 'task.completed',
      data: { test: true },
      timestamp: new Date().toISOString(),
    };

    try {
      await deliveryService.deliver(subscription, testEvent);
      return reply.status(200).send(createApiResponse({ event: testEvent.type, delivered: true, timestamp: testEvent.timestamp }));
    } catch (err) {
      app.log.error({ err }, 'Test webhook delivery failed');
      return reply.status(200).send(createApiResponse({ event: testEvent.type, delivered: false, timestamp: testEvent.timestamp }));
    }
  });
};
