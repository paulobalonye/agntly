import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import type { PaymentService } from '../services/payment-service.js';

const checkoutSchema = z.object({
  walletId: z.string().uuid(),
  amountUsd: z.number().positive().min(1).max(10000),
  method: z.enum(['card', 'ach']),
});

const historySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const paymentRoutes: FastifyPluginAsync = async (app) => {
  const paymentService = (app as any).paymentService as PaymentService;

  // POST /checkout — Create Stripe Checkout Session
  app.post('/checkout', async (request, reply) => {
    const parsed = checkoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send(createErrorResponse('Invalid request: walletId (uuid), amountUsd (1-10000), method (card|ach) required'));
    }

    // userId comes from auth middleware; fall back to demo-user in dev
    const userId = (request as any).userId ?? 'demo-user';

    try {
      const result = await paymentService.createCheckout(
        userId,
        parsed.data.walletId,
        parsed.data.amountUsd,
        parsed.data.method,
      );
      return reply.status(201).send(createApiResponse(result));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Checkout creation failed';
      const status = message.includes('does not belong') ? 403 : 400;
      return reply.status(status).send(createErrorResponse(message));
    }
  });

  // GET /history — Paginated payment history
  app.get('/history', async (request, reply) => {
    const parsed = historySchema.safeParse(request.query);
    const { limit, offset } = parsed.success ? parsed.data : { limit: 20, offset: 0 };

    // userId comes from auth middleware; fall back to demo-user in dev
    const userId = (request as any).userId ?? 'demo-user';

    const result = await paymentService.getPaymentHistory(userId, limit, offset);
    // Inline response to include meta field (createApiResponse does not support meta)
    return reply.status(200).send({
      success: true,
      data: result.payments,
      error: null,
      meta: { total: result.total, limit: result.limit, offset: result.offset },
    });
  });
};
