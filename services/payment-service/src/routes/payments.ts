import type { FastifyPluginAsync } from 'fastify';
import { createApiResponse, createErrorResponse, generateId } from '@agntly/shared';

export const paymentRoutes: FastifyPluginAsync = async (app) => {
  app.post('/checkout', async (request, reply) => {
    const body = request.body as { amountUsd: number; walletId: string } | undefined;
    if (!body?.amountUsd || !body?.walletId) return reply.status(400).send(createErrorResponse('amountUsd and walletId required'));
    return reply.status(200).send(createApiResponse({
      checkoutId: generateId('chk'), url: `https://checkout.stripe.com/pay/${generateId('cs')}`,
      amountUsd: body.amountUsd, walletId: body.walletId, status: 'pending',
    }));
  });

  app.post('/webhook', async (request, reply) => {
    return reply.status(200).send({ received: true });
  });

  app.get('/history', async (request, reply) => {
    return reply.status(200).send(createApiResponse([]));
  });
};
