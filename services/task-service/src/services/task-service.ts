import { generateId, calculateFee, DEFAULT_TASK_TIMEOUT_MS } from '@agntly/shared';
import type { EventBus } from '@agntly/shared';
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
  ): Promise<TaskRow> {
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

    return task;
  }

  async getTask(taskId: string): Promise<TaskRow | null> {
    return this.repo.findById(taskId);
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

  async completeTask(taskId: string, result: Record<string, unknown>): Promise<TaskRow> {
    const createdAt = (await this.repo.findById(taskId))?.createdAt;
    const latencyMs = createdAt !== undefined ? Date.now() - createdAt.getTime() : null;
    const settleTx = `0x${Buffer.from(taskId).toString('hex').padEnd(64, 'f').slice(0, 64)}`;

    const task = await this.repo.transition(
      taskId,
      ['escrowed', 'dispatched'],
      'complete',
      {
        result,
        ...(latencyMs !== null ? { latencyMs } : {}),
        settleTx,
      },
    );

    if (!task) {
      const current = await this.repo.findById(taskId);
      const stateInfo = current ? `current status: ${current.status}` : 'task not found';
      throw new Error(`Cannot complete task ${taskId}: ${stateInfo}`);
    }

    await this.repo.addAuditEntry({
      taskId: task.id,
      status: 'complete',
      details: `Task completed in ${task.latencyMs ?? latencyMs}ms`,
    });

    if (this.eventBus) {
      await this.eventBus.publish('task.completed', {
        taskId: task.id,
        result,
        latencyMs: task.latencyMs,
        settleTx: task.settleTx,
      });
    }

    return task;
  }

  async disputeTask(taskId: string, reason: string): Promise<TaskRow> {
    const task = await this.repo.transition(
      taskId,
      ['escrowed', 'dispatched'],
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
}
