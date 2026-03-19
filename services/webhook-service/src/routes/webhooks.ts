import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse, generateId } from '@agntly/shared';
import type { WebhookSubscription, WebhookEvent } from '@agntly/shared';

const subs = new Map<string, WebhookSubscription>();

const createSchema = z.object({
  url: z.string().url(), secret: z.string().min(16),
  events: z.array(z.enum(['task.escrowed', 'task.completed', 'task.failed', 'task.disputed', 'wallet.funded', 'wallet.withdrawn', 'agent.verified'])),
});

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.post('/', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse('Invalid webhook config'));
    const id = generateId('whk');
    const sub: WebhookSubscription = { id, userId: 'demo-user', url: parsed.data.url, secret: parsed.data.secret, events: parsed.data.events as WebhookEvent[], active: true, createdAt: new Date() };
    subs.set(id, sub);
    return reply.status(201).send(createApiResponse(sub));
  });

  app.get('/', async (request, reply) => {
    return reply.status(200).send(createApiResponse(Array.from(subs.values())));
  });

  app.delete('/:webhookId', async (request, reply) => {
    const { webhookId } = request.params as { webhookId: string };
    subs.delete(webhookId);
    return reply.status(200).send(createApiResponse({ deleted: true }));
  });

  app.post('/test', async (request, reply) => {
    return reply.status(200).send(createApiResponse({ event: 'task.completed', delivered: true, timestamp: new Date().toISOString() }));
  });
};
