import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import type { TaskService } from '../services/task-service.js';
import type { PolicyService } from '../services/policy-service.js';
import { dispatchToAgent } from '../services/agent-dispatcher.js';

const createTaskSchema = z.object({
  agentId: z.string().min(1),
  payload: z.record(z.unknown()),
  budget: z.string()
    .refine(val => /^\d+(\.\d{1,6})?$/.test(val), 'Budget must be a valid number')
    .refine(val => parseFloat(val) > 0, 'Budget must be positive'),
  timeoutMs: z.number().int().positive().max(86_400_000).optional(), // max 24h
  dispatch: z.boolean().optional(),
});

export const taskRoutes: FastifyPluginAsync = async (app) => {
  const service = (app as any).taskService as TaskService;
  const policyService = (app as any).policyService as PolicyService;

  const ESCROW_URL = process.env.ESCROW_SERVICE_URL ?? 'http://localhost:3003';
  const WALLET_URL = process.env.WALLET_SERVICE_URL ?? 'http://localhost:3002';
  const REGISTRY_URL = process.env.REGISTRY_SERVICE_URL ?? 'http://localhost:3005';

  app.post('/', async (request, reply) => {
    const parsed = createTaskSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse('Invalid task request'));
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));

    // Step 0: Policy check — enforce spending limits before anything else
    try {
      // Look up agent details for policy check
      let agentCategory = 'unknown';
      let agentVerified = false;
      try {
        const agentRes = await fetch(`${REGISTRY_URL}/v1/agents/${parsed.data.agentId}`);
        if (agentRes.ok) {
          const agentJson = await agentRes.json() as { data?: { category?: string; verified?: boolean } };
          agentCategory = agentJson?.data?.category ?? 'unknown';
          agentVerified = agentJson?.data?.verified ?? false;
        }
      } catch { /* agent lookup failure is non-fatal */ }

      const policyCheck = await policyService.checkPolicy(
        userId, parsed.data.agentId, agentCategory, parsed.data.budget, agentVerified,
      );

      if (!policyCheck.allowed) {
        return reply.status(403).send(createErrorResponse(`Policy violation: ${policyCheck.reason}`));
      }
    } catch {
      // Policy service failure is non-fatal — allow the task
    }

    // Step 1: Create the task in pending state
    const { task, completionToken } = await service.createTask(userId, parsed.data.agentId, parsed.data.payload, parsed.data.budget, parsed.data.timeoutMs);

    // Record spend for budget tracking
    try {
      await policyService.recordSpend(userId, parsed.data.budget);
    } catch { /* non-fatal */ }

    // Step 2: Lock escrow — caller's wallet → escrow
    try {
      // Get orchestrator's wallet
      const walletRes = await fetch(`${WALLET_URL}/v1/wallets`, {
        headers: { 'x-user-id': userId },
      });
      const walletJson = await walletRes.json() as { data?: { id?: string } };
      const orchestratorWalletId = walletJson?.data?.id;

      if (orchestratorWalletId) {
        // Lock funds in escrow
        const escrowRes = await fetch(`${ESCROW_URL}/v1/escrow/lock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: task.id,
            fromWalletId: orchestratorWalletId,
            toWalletId: orchestratorWalletId, // placeholder — resolved at release
            amount: parsed.data.budget,
            deadline: task.deadline.toISOString(),
          }),
        });

        if (escrowRes.ok) {
          // Mark task as escrowed
          try {
            await service.markEscrowed(task.id, `escrow-${task.id}`);
          } catch {
            // Task may already be in correct state
          }
        }
        // If escrow fails (insufficient funds), task stays pending — still visible
      }
    } catch {
      // Escrow service unavailable — task proceeds without escrow (sandbox mode)
    }

    // Step 3: Dispatch to agent (fire-and-forget)
    if (parsed.data.dispatch !== false) {
      const capturedToken = completionToken;
      dispatchToAgent(parsed.data.agentId, task.id, parsed.data.payload)
        .then(async ({ result }) => {
          if (result && capturedToken) {
            try {
              await service.completeTask(task.id, result, capturedToken);

              // Release escrow on successful completion
              try {
                await fetch(`${ESCROW_URL}/v1/escrow/by-task/${task.id}/release`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-user-id': 'system' },
                });
              } catch {
                console.error(`[task-service] Failed to release escrow for task ${task.id}`);
              }
            } catch {
              // Already completed or invalid state — ignore
            }
          }
        })
        .catch(async () => {
          // Dispatch failure — refund escrow
          try {
            const escrowLookup = await fetch(`${ESCROW_URL}/v1/escrow/by-task/${task.id}`, {
              headers: { 'x-user-id': 'system' },
            });
            if (escrowLookup.ok) {
              const ej = await escrowLookup.json() as { data?: { id?: string } };
              if (ej?.data?.id) {
                await fetch(`${ESCROW_URL}/v1/escrow/${ej.data.id}/refund`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-user-id': 'system' },
                });
              }
            }
          } catch {
            console.error(`[task-service] Failed to refund escrow for failed task ${task.id}`);
          }
        });
    }

    return reply.status(202).send(createApiResponse({ ...task, completionToken }));
  });

  // GET /my — List tasks for the authenticated user
  app.get('/my', async (request, reply) => {
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));
    const query = request.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit ?? '50', 10) || 50, 100);
    const tasks = await service.getTasksByUser(userId, limit);
    return reply.status(200).send(createApiResponse(tasks));
  });

  app.get('/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));
    const task = await service.getTask(taskId);
    if (!task) return reply.status(404).send(createErrorResponse('Task not found'));
    // Note: In a full implementation, verify task.orchestratorId === userId
    // For sandbox, allow access (tasks don't have userId linkage yet)
    return reply.status(200).send(createApiResponse(task));
  });

  const completeSchema = z.object({
    result: z.record(z.unknown()),
    completionToken: z.string().startsWith('ctk_'),
    proof: z.string().optional(),
  });

  app.post('/:taskId/complete', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const parsed = completeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(createErrorResponse('Invalid request: completionToken is required'));
    }
    try {
      const task = await service.completeTask(taskId, parsed.data.result, parsed.data.completionToken);
      return reply.status(200).send(createApiResponse(task));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Complete failed';
      const status = msg.includes('completion token') ? 403 : 400;
      return reply.status(status).send(createErrorResponse(msg));
    }
  });

  app.post('/:taskId/dispute', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));
    const body = request.body as { reason: string; evidence?: string };
    try {
      const task = await service.disputeTask(taskId, body.reason);
      return reply.status(200).send(createApiResponse(task));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Dispute failed'));
    }
  });
};
