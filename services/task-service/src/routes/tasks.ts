import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import type { TaskService } from '../services/task-service.js';

const createTaskSchema = z.object({
  agentId: z.string(), payload: z.record(z.unknown()), budget: z.string(), timeoutMs: z.number().optional(),
});

export const taskRoutes: FastifyPluginAsync = async (app) => {
  const service = (app as any).taskService as TaskService;

  app.post('/', async (request, reply) => {
    const parsed = createTaskSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse('Invalid task request'));
    const { task, completionToken } = await service.createTask('demo-user', parsed.data.agentId, parsed.data.payload, parsed.data.budget, parsed.data.timeoutMs);
    return reply.status(202).send(createApiResponse({ ...task, completionToken }));
  });

  app.get('/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const task = await service.getTask(taskId);
    if (!task) return reply.status(404).send(createErrorResponse('Task not found'));
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
    const body = request.body as { reason: string; evidence?: string };
    try {
      const task = await service.disputeTask(taskId, body.reason);
      return reply.status(200).send(createApiResponse(task));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Dispute failed'));
    }
  });
};
