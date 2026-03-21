import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import type { LicenseService } from '../services/license-service.js';

const activateSchema = z.object({
  purchaseCode: z.string().min(1, 'Purchase code is required'),
  domain: z.string().min(1, 'Domain is required'),
});

const deactivateSchema = z.object({
  purchaseCode: z.string().min(1, 'Purchase code is required'),
});

const verifySchema = z.object({
  domain: z.string().min(1, 'Domain is required'),
});

export const licenseRoutes: FastifyPluginAsync = async (app) => {
  const service = (app as any).licenseService as LicenseService;

  // POST /activate — Activate a license for a domain
  app.post('/activate', async (request, reply) => {
    const parsed = activateSchema.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid input';
      return reply.status(400).send(createErrorResponse(msg));
    }

    const result = await service.activate(parsed.data.purchaseCode, parsed.data.domain);
    if (!result.success) {
      return reply.status(400).send(createErrorResponse(result.error ?? 'Activation failed'));
    }

    return reply.status(200).send(createApiResponse({
      activated: true,
      domain: result.license?.domain,
      licenseType: result.license?.licenseType,
    }));
  });

  // POST /deactivate — Free a license from its domain
  app.post('/deactivate', async (request, reply) => {
    const parsed = deactivateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(createErrorResponse('Purchase code is required'));
    }

    const result = await service.deactivate(parsed.data.purchaseCode);
    if (!result.success) {
      return reply.status(400).send(createErrorResponse(result.error ?? 'Deactivation failed'));
    }

    return reply.status(200).send(createApiResponse({ deactivated: true }));
  });

  // POST /verify — Check if a domain has a valid license
  app.post('/verify', async (request, reply) => {
    const parsed = verifySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(createErrorResponse('Domain is required'));
    }

    const result = await service.verify(parsed.data.domain);
    return reply.status(200).send(createApiResponse({
      valid: result.valid,
      licenseType: result.license?.licenseType ?? null,
      error: result.error ?? null,
    }));
  });

  // GET /status?code=xxx — Check license status by purchase code
  app.get('/status', async (request, reply) => {
    const { code } = request.query as { code?: string };
    if (!code) return reply.status(400).send(createErrorResponse('code query param required'));

    const license = await service.findByPurchaseCode(code);
    if (!license) return reply.status(404).send(createErrorResponse('License not found'));

    return reply.status(200).send(createApiResponse({
      status: license.status,
      domain: license.domain,
      licenseType: license.licenseType,
      activatedAt: license.activatedAt,
    }));
  });

  // ── Admin endpoints ──────────────────────────────────────

  // GET /admin/list — List all licenses (admin only)
  app.get('/admin/list', async (request, reply) => {
    const { limit, offset } = request.query as { limit?: string; offset?: string };
    const result = await service.listAll(
      Math.min(parseInt(limit ?? '50', 10) || 50, 100),
      parseInt(offset ?? '0', 10) || 0,
    );
    return reply.status(200).send({
      success: true,
      data: result.licenses,
      error: null,
      meta: { total: result.total, limit: parseInt(limit ?? '50', 10), offset: parseInt(offset ?? '0', 10) },
    });
  });

  // POST /admin/create — Create a manual license
  app.post('/admin/create', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const purchaseCode = body.purchaseCode as string | undefined;
    if (!purchaseCode) {
      return reply.status(400).send(createErrorResponse('purchaseCode is required'));
    }
    const result = await service.createManual({
      purchaseCode,
      buyerEmail: body.buyerEmail as string | undefined,
      buyerName: body.buyerName as string | undefined,
      domain: body.domain as string | undefined,
      licenseType: body.licenseType as string | undefined,
    });
    if (!result.success) {
      return reply.status(400).send(createErrorResponse(result.error ?? 'Creation failed'));
    }
    return reply.status(201).send(createApiResponse(result.license));
  });

  // PUT /admin/update — Update license details
  app.put('/admin/update', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const purchaseCode = body.purchaseCode as string | undefined;
    if (!purchaseCode) {
      return reply.status(400).send(createErrorResponse('purchaseCode is required'));
    }
    const result = await service.update(purchaseCode, {
      buyerEmail: body.buyerEmail as string | undefined,
      buyerName: body.buyerName as string | undefined,
      domain: body.domain as string | undefined,
      licenseType: body.licenseType as string | undefined,
      status: body.status as string | undefined,
    });
    if (!result.success) {
      return reply.status(400).send(createErrorResponse(result.error ?? 'Update failed'));
    }
    return reply.status(200).send(createApiResponse(result.license));
  });

  // POST /admin/revoke — Revoke a license
  app.post('/admin/revoke', async (request, reply) => {
    const parsed = deactivateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(createErrorResponse('Purchase code is required'));
    }
    await service.revoke(parsed.data.purchaseCode);
    return reply.status(200).send(createApiResponse({ revoked: true }));
  });

  // DELETE /admin/delete — Permanently delete a license
  app.delete('/admin/delete', async (request, reply) => {
    const { code } = request.query as { code?: string };
    if (!code) return reply.status(400).send(createErrorResponse('code query param required'));
    const result = await service.deleteLicense(code);
    if (!result.success) {
      return reply.status(404).send(createErrorResponse(result.error ?? 'Delete failed'));
    }
    return reply.status(200).send(createApiResponse({ deleted: true }));
  });

  // GET /admin/search — Search licenses
  app.get('/admin/search', async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q || q.length < 2) {
      return reply.status(400).send(createErrorResponse('Search query must be at least 2 characters'));
    }
    const results = await service.search(q);
    return reply.status(200).send(createApiResponse(results));
  });
};
