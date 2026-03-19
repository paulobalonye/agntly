import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setupTestDb, cleanTestDb, teardownTestDb } from './setup.js';
import { TaskRepository } from '../../services/task-service/src/repositories/task-repository.js';
import { TaskService } from '../../services/task-service/src/services/task-service.js';
import { generateCompletionToken } from '@agntly/shared';
import type { DbConnection } from '@agntly/shared';

let db: DbConnection;
let taskService: TaskService;

beforeAll(async () => {
  const ctx = await setupTestDb();
  db = ctx.db;
  const taskRepo = new TaskRepository(db);
  taskService = new TaskService(taskRepo);
});

beforeEach(async () => {
  await cleanTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

describe('Anti-spoofing: completion token validation', () => {
  it('should accept completion with valid token', async () => {
    const orchestratorId = randomUUID();
    const agentId = 'agent-search';

    const { task, completionToken } = await taskService.createTask(
      orchestratorId,
      agentId,
      { type: 'search', query: 'test' },
      '1.000000',
    );
    expect(task.status).toBe('pending');

    await taskService.markEscrowed(task.id, 'tx-valid-token-test');

    const completedTask = await taskService.completeTask(
      task.id,
      { output: 'search results' },
      completionToken,
    );
    expect(completedTask.status).toBe('complete');
  });

  it('should reject completion with wrong token', async () => {
    const orchestratorId = randomUUID();
    const agentId = 'agent-search';

    const { task } = await taskService.createTask(
      orchestratorId,
      agentId,
      { type: 'search', query: 'test' },
      '1.000000',
    );

    await taskService.markEscrowed(task.id, 'tx-wrong-token-test');

    await expect(
      taskService.completeTask(task.id, { output: 'spoofed result' }, 'ctk_invalid_token'),
    ).rejects.toThrow('Invalid completion token');
  });

  it('should reject completion with token for different agent', async () => {
    const orchestratorId = randomUUID();
    const agentId = 'agent-search';

    const { task } = await taskService.createTask(
      orchestratorId,
      agentId,
      { type: 'search', query: 'test' },
      '1.000000',
    );

    await taskService.markEscrowed(task.id, 'tx-wrong-agent-test');

    // Generate a valid token but for a different agent
    const tokenForDifferentAgent = generateCompletionToken(task.id, 'agent-DIFFERENT');

    await expect(
      taskService.completeTask(task.id, { output: 'spoofed result' }, tokenForDifferentAgent),
    ).rejects.toThrow('Invalid completion token');
  });

  it('should reject completion with token for different task', async () => {
    const orchestratorId = randomUUID();
    const agentId = 'agent-search';

    const { task } = await taskService.createTask(
      orchestratorId,
      agentId,
      { type: 'search', query: 'test' },
      '1.000000',
    );

    await taskService.markEscrowed(task.id, 'tx-wrong-task-test');

    // Generate a valid token but for a different task ID
    const tokenForDifferentTask = generateCompletionToken('tsk_different_id', agentId);

    await expect(
      taskService.completeTask(task.id, { output: 'spoofed result' }, tokenForDifferentTask),
    ).rejects.toThrow('Invalid completion token');
  });
});
