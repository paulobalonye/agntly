import type { FastifyPluginAsync } from 'fastify';
import type { PaymentService } from '../services/payment-service.js';

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  // CRITICAL: Register raw body parser scoped to this plugin only.
  // Fastify's default JSON parser would parse the body to an object, breaking
  // Stripe's HMAC signature verification which requires the raw bytes.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body),
  );

  app.post('/webhook', async (request, reply) => {
    const paymentService = (app as any).paymentService as PaymentService;
    const signature = request.headers['stripe-signature'] as string | undefined;

    if (!signature) {
      return reply.status(400).send({ error: 'Missing stripe-signature header' });
    }

    try {
      await paymentService.handleWebhook(signature, request.body as Buffer);
      return reply.status(200).send({ received: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook processing failed';
      if (message.includes('signature') || message.includes('Webhook')) {
        return reply.status(400).send({ error: 'Invalid webhook signature' });
      }
      request.log.error({ err }, 'Webhook processing error');
      return reply.status(500).send({ error: 'Internal error' });
    }
  });
};
