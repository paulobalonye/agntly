import { generateId, calculateFee, DEFAULT_TASK_TIMEOUT_MS } from '@agntly/shared';
import type { Task } from '@agntly/shared';

const tasks = new Map<string, Task>();

export class TaskService {
  async createTask(orchestratorId: string, agentId: string, payload: Record<string, unknown>, budget: string, timeoutMs?: number): Promise<Task> {
    const id = generateId('tsk');
    const { fee } = calculateFee(budget);
    const timeout = timeoutMs ?? DEFAULT_TASK_TIMEOUT_MS;
    const task: Task = {
      id, orchestratorId, agentId, payload, result: null, status: 'escrowed',
      amount: budget, fee, escrowTx: `0x${Buffer.from(id).toString('hex').padEnd(64, '0')}`, settleTx: null,
      deadline: new Date(Date.now() + timeout), latencyMs: null, createdAt: new Date(),
    };
    tasks.set(id, task);
    return task;
  }

  async getTask(taskId: string): Promise<Task | null> {
    return tasks.get(taskId) ?? null;
  }

  async completeTask(taskId: string, result: Record<string, unknown>): Promise<Task> {
    const task = tasks.get(taskId);
    if (!task) throw new Error('Task not found');
    if (task.status !== 'escrowed' && task.status !== 'dispatched') throw new Error(`Cannot complete task in state: ${task.status}`);
    const latencyMs = Date.now() - task.createdAt.getTime();
    const completed: Task = { ...task, status: 'complete', result, latencyMs, settleTx: `0x${Buffer.from(taskId).toString('hex').padEnd(64, 'f')}` };
    tasks.set(taskId, completed);
    return completed;
  }

  async disputeTask(taskId: string, reason: string): Promise<Task> {
    const task = tasks.get(taskId);
    if (!task) throw new Error('Task not found');
    const disputed: Task = { ...task, status: 'disputed' };
    tasks.set(taskId, disputed);
    return disputed;
  }
}
