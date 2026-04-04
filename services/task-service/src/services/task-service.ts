import { generateId, calculateFee, DEFAULT_TASK_TIMEOUT_MS, generateCompletionToken, verifyCompletionToken } from '@agntly/shared';
import type { EventBus, TaskStatus } from '@agntly/shared';
import type { TaskRepository, TaskRow } from '../repositories/task-repository.js';

export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly eventBus?: EventBus,
  ) {}

  async createTask(
    orchestratorId: string,
    agentId: string,
    payload: Record<string, unknown>,
    budget: string,
    timeoutMs?: number,
  ): Promise<{ task: TaskRow; completionToken: string }> {
    const id = generateId('tsk');
    const { fee } = calculateFee(budget);
    const timeout = timeoutMs ?? DEFAULT_TASK_TIMEOUT_MS;
    const deadline = new Date(Date.now() + timeout);

    const task = await this.repo.create({
      id,
      orchestratorId,
      agentId,
      payload,
      amount: budget,
      fee,
      deadline,
    });

    await this.repo.addAuditEntry({
      taskId: task.id,
      status: 'pending',
      details: `Task created for agent ${agentId}`,
    });

    if (this.eventBus) {
      await this.eventBus.publish('task.created', {
        taskId: task.id,
        orchestratorId: task.orchestratorId,
        agentId: task.agentId,
        amount: task.amount,
        fee: task.fee,
        deadline: task.deadline.toISOString(),
      });
    }

    const completionToken = generateCompletionToken(id, agentId);
    return { task, completionToken };
  }

  async getTask(taskId: string): Promise<TaskRow | null> {
    return this.repo.findById(taskId);
  }

  async getTasksByUser(userId: string, limit = 50): Promise<TaskRow[]> {
    return this.repo.findByUser(userId, limit);
  }

  async markEscrowed(taskId: string, escrowTx: string): Promise<TaskRow> {
    const task = await this.repo.transition(taskId, ['pending'], 'escrowed', { escrowTx });

    if (!task) {
      const current = await this.repo.findById(taskId);
      const stateInfo = current ? `current status: ${current.status}` : 'task not found';
      throw new Error(`Cannot mark task ${taskId} as escrowed: ${stateInfo}`);
    }

    await this.repo.addAuditEntry({
      taskId: task.id,
      status: 'escrowed',
      details: `Escrow transaction: ${escrowTx}`,
    });

    if (this.eventBus) {
      await this.eventBus.publish('task.escrowed', {
        taskId: task.id,
        escrowTx,
      });
    }

    return task;
  }

  async markDispatched(taskId: string): Promise<TaskRow> {
    const isSandbox = process.env.APP_ENV !== 'production';
    const allowedFromStates: readonly string[] = isSandbox
      ? ['pending', 'escrowed']
      : ['escrowed'];

    const task = await this.repo.transition(
      taskId,
      allowedFromStates as readonly TaskStatus[],
      'dispatched',
    );

    if (!task) {
      const current = await this.repo.findById(taskId);
      const stateInfo = current ? `current status: ${current.status}` : 'task not found';
      throw new Error(`Cannot mark task ${taskId} as dispatched: ${stateInfo}`);
    }

    await this.repo.addAuditEntry({
      taskId: task.id,
      status: 'dispatched',
      details: 'Task dispatched to agent endpoint',
    });

    if (this.eventBus) {
      await this.eventBus.publish('task.dispatched', {
        taskId: task.id,
        agentId: task.agentId,
      });
    }

    return task;
  }

  async completeTask(
    taskId: string,
    result: Record<string, unknown>,
    completionToken: string,
  ): Promise<TaskRow> {
    const task = await this.repo.findById(taskId);
    if (!task) throw new Error('Task not found');

    // Anti-spoofing: verify the caller has the valid completion token
    if (!verifyCompletionToken(completionToken, taskId, task.agentId)) {
      throw new Error('Invalid completion token — only the assigned agent can complete this task');
    }

    const createdAt = task.createdAt;
    const latencyMs = createdAt !== undefined ? Date.now() - createdAt.getTime() : null;
    const settleTx = `0x${Buffer.from(taskId).toString('hex').padEnd(64, 'f').slice(0, 64)}`;

    // In sandbox mode, allow completing tasks directly from 'pending' (escrow may be skipped)
    const isSandbox = process.env.APP_ENV !== 'production';
    const allowedFromStates: readonly string[] = isSandbox
      ? ['pending', 'escrowed', 'dispatched']
      : ['escrowed', 'dispatched'];

    const completedTask = await this.repo.transition(
      taskId,
      allowedFromStates as readonly TaskStatus[],
      'complete',
      {
        result,
        ...(latencyMs !== null ? { latencyMs } : {}),
        settleTx,
      },
    );

    if (!completedTask) {
      const current = await this.repo.findById(taskId);
      const stateInfo = current ? `current status: ${current.status}` : 'task not found';
      throw new Error(`Cannot complete task ${taskId}: ${stateInfo}`);
    }

    await this.repo.addAuditEntry({
      taskId: completedTask.id,
      status: 'complete',
      details: `Task completed in ${completedTask.latencyMs ?? latencyMs}ms`,
    });

    if (this.eventBus) {
      await this.eventBus.publish('task.completed', {
        taskId: completedTask.id,
        agentId: completedTask.agentId,
        result,
        latencyMs: completedTask.latencyMs,
        settleTx: completedTask.settleTx,
      });
    }

    // Update agent stats (fire-and-forget via registry service)
    this.updateAgentStats(completedTask.agentId, completedTask.latencyMs ?? latencyMs).catch(() => {});

    return completedTask;
  }

  /**
   * Increment agent call count and update rolling average latency.
   * Uses the registry service's internal API. Non-fatal if unreachable.
   */
  private async updateAgentStats(agentId: string, latencyMs: number | null): Promise<void> {
    const registryUrl = process.env.REGISTRY_SERVICE_URL ?? 'http://localhost:3005';
    await fetch(`${registryUrl}/v1/agents/${agentId}/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'system' },
      body: JSON.stringify({ latencyMs }),
    });
  }

  async disputeTask(taskId: string, reason: string): Promise<TaskRow> {
    const isSandbox = process.env.APP_ENV !== 'production';
    const allowedFromStates: readonly string[] = isSandbox
      ? ['pending', 'escrowed', 'dispatched']
      : ['escrowed', 'dispatched'];

    const task = await this.repo.transition(
      taskId,
      allowedFromStates as readonly TaskStatus[],
      'disputed',
      { errorMessage: reason },
    );

    if (!task) {
      const current = await this.repo.findById(taskId);
      const stateInfo = current ? `current status: ${current.status}` : 'task not found';
      throw new Error(`Cannot dispute task ${taskId}: ${stateInfo}`);
    }

    await this.repo.addAuditEntry({
      taskId: task.id,
      status: 'disputed',
      details: `Dispute raised: ${reason}`,
    });

    if (this.eventBus) {
      await this.eventBus.publish('task.disputed', {
        taskId: task.id,
        reason,
      });
    }

    return task;
  }

  /**
   * Sweep tasks that have exceeded their deadline. Transitions them to 'failed'
   * and publishes task.failed events. Called on an interval from the server.
   */
  async sweepExpiredTasks(): Promise<number> {
    const expired = await this.repo.findExpired();
    let count = 0;

    for (const task of expired) {
      const failed = await this.repo.transition(
        task.id,
        ['pending', 'escrowed', 'dispatched'] as readonly TaskStatus[],
        'failed',
        { errorMessage: 'Task exceeded deadline' },
      );

      if (failed) {
        count++;
        await this.repo.addAuditEntry({
          taskId: task.id,
          status: 'failed',
          details: `Task timed out (deadline: ${String(task.deadline)})`,
        });

        if (this.eventBus) {
          await this.eventBus.publish('task.failed', {
            taskId: task.id,
            agentId: task.agentId,
            reason: 'timeout',
          });
        }
      }
    }

    return count;
  }
}
