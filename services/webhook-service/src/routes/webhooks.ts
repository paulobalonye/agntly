import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import type { WebhookRepository } from '../repositories/webhook-repository.js';
import type { DeliveryService } from '../services/delivery-service.js';

function isPublicUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    const hostname = url.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    if (hostname.startsWith('10.')) return false;
    if (hostname.startsWith('172.') && parseInt(hostname.split('.')[1] ?? '0') >= 16 && parseInt(hostname.split('.')[1] ?? '0') <= 31) return false;
    if (hostname.startsWith('192.168.')) return false;
    if (hostname === '169.254.169.254') return false; // AWS metadata
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return false;
    return true;
  } catch {
    return false;
  }
}

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
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));
    if (!isPublicUrl(url)) return reply.status(400).send(createErrorResponse('URL must be a public HTTPS/HTTP endpoint'));

    const subscription = await webhookRepo.createSubscription({ userId, url, secret, events });

    // Return subscription without exposing raw secret
    const { secretHash: _, ...safeSubscription } = subscription;
    return reply.status(201).send(createApiResponse(safeSubscription));
  });

  // GET / — List user's subscriptions
  app.get('/', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));
    const subscriptions = await webhookRepo.findSubscriptionsByUserId(userId);
    const safe = subscriptions.map(({ secretHash: _, ...rest }) => rest);
    return reply.status(200).send(createApiResponse(safe));
  });

  // DELETE /:webhookId — Delete subscription
  app.delete('/:webhookId', async (request, reply) => {
    const { webhookId } = request.params as { webhookId: string };
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));
    const sub = await webhookRepo.findSubscriptionById(webhookId);
    if (!sub) return reply.status(404).send(createErrorResponse('Subscription not found'));
    if (sub.userId !== userId) return reply.status(403).send(createErrorResponse('Access denied'));
    await webhookRepo.deleteSubscription(webhookId);
    return reply.status(200).send(createApiResponse({ deleted: true }));
  });

  // POST /test — Test webhook delivery
  app.post('/test', async (request, reply) => {
    const parsed = testSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(createErrorResponse('webhookId (uuid) is required'));
    }

    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));

    const subscription = await webhookRepo.findSubscriptionById(parsed.data.webhookId);
    if (!subscription) {
      return reply.status(404).send(createErrorResponse('Subscription not found'));
    }
    if (subscription.userId !== userId) {
      return reply.status(403).send(createErrorResponse('Access denied'));
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
