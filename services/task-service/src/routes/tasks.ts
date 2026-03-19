import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse, createDbConnection } from '@agntly/shared';
import { TaskService } from '../services/task-service.js';
import { TaskRepository } from '../repositories/task-repository.js';

const createTaskSchema = z.object({
  agentId: z.string(), payload: z.record(z.unknown()), budget: z.string(), timeoutMs: z.number().optional(),
});

export const taskRoutes: FastifyPluginAsync = async (app) => {
  const db = createDbConnection();
  const taskService = new TaskService(new TaskRepository(db));

  app.post('/', async (request, reply) => {
    const parsed = createTaskSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse('Invalid task request'));
    const task = await taskService.createTask('demo-user', parsed.data.agentId, parsed.data.payload, parsed.data.budget, parsed.data.timeoutMs);
    return reply.status(202).send(createApiResponse(task));
  });

  app.get('/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const task = await taskService.getTask(taskId);
    if (!task) return reply.status(404).send(createErrorResponse('Task not found'));
    return reply.status(200).send(createApiResponse(task));
  });

  app.post('/:taskId/complete', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const body = request.body as { result: Record<string, unknown>; proof?: string };
    try {
      const task = await taskService.completeTask(taskId, body.result);
      return reply.status(200).send(createApiResponse(task));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Complete failed'));
    }
  });

  app.post('/:taskId/dispute', async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const body = request.body as { reason: string; evidence?: string };
    try {
      const task = await taskService.disputeTask(taskId, body.reason);
      return reply.status(200).send(createApiResponse(task));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Dispute failed'));
    }
  });
};
