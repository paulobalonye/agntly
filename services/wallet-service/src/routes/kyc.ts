import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import type { KycService } from '../services/kyc-service.js';

const tier2Schema = z.object({
  fullName: z.string().min(2).max(200),
  country: z.string().min(2).max(3),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
});

export const kycRoutes: FastifyPluginAsync = async (app) => {
  const kycService = (app as any).kycService as KycService;

  // GET / — Get user's KYC status
  app.get('/', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));

    const record = await kycService.getKycStatus(userId);
    return reply.status(200).send(createApiResponse(record ?? {
      tier: 'none',
      status: 'unverified',
      message: 'KYC not started. Submit Tier 2 to enable fiat withdrawals.',
    }));
  });

  // POST /tier2 — Submit light KYC (name, country, DOB)
  app.post('/tier2', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));

    const parsed = tier2Schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(createErrorResponse(parsed.error.issues[0]?.message ?? 'Invalid input'));
    }

    try {
      const record = await kycService.submitTier2(userId, parsed.data);
      return reply.status(200).send(createApiResponse(record));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'KYC submission failed'));
    }
  });

  // POST /tier3 — Initiate full KYC (redirects to provider)
  app.post('/tier3', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));

    // In production, this would redirect to Persona/Sumsub
    // For now, return a stub
    return reply.status(200).send(createApiResponse({
      message: 'Tier 3 KYC requires identity verification. Redirect URL will be provided when KYC provider is configured.',
      provider: 'pending_configuration',
    }));
  });
};
