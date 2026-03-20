import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import type { TaskService } from '../services/task-service.js';
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

  app.post('/', async (request, reply) => {
    const parsed = createTaskSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse('Invalid task request'));
    const userId = (request as any).userId;
    if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));
    const { task, completionToken } = await service.createTask(userId, parsed.data.agentId, parsed.data.payload, parsed.data.budget, parsed.data.timeoutMs);

    // If dispatch is requested (default true), fire-and-forget call to agent endpoint
    if (parsed.data.dispatch !== false) {
      const capturedToken = completionToken;
      dispatchToAgent(parsed.data.agentId, task.id, parsed.data.payload)
        .then(async ({ result }) => {
          if (result && capturedToken) {
            try {
              await service.completeTask(task.id, result, capturedToken);
            } catch {
              // Already completed or invalid state — ignore
            }
          }
        })
        .catch(() => {
          // Dispatch failure is non-fatal; task remains in pending/escrowed state
        });
    }

    return reply.status(202).send(createApiResponse({ ...task, completionToken }));
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
