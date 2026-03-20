import type { HttpClient } from '../client.js';
import type { Task, CreateTaskParams, CompleteTaskParams, DisputeTaskParams } from '../types.js';

export class TasksResource {
  constructor(private readonly client: HttpClient) {}

  /**
   * Create a task. The server returns a flat object { ...taskFields, completionToken }.
   * We reshape it into { task, completionToken } for a cleaner API.
   */
  async create(params: CreateTaskParams): Promise<{ task: Task; completionToken: string }> {
    const raw = await this.client.post<Record<string, unknown>>('/v1/tasks', params);
    const { completionToken, ...taskFields } = raw;
    return {
      task: taskFields as unknown as Task,
      completionToken: completionToken as string,
    };
  }

  async get(taskId: string): Promise<Task> {
    return this.client.get<Task>(`/v1/tasks/${encodeURIComponent(taskId)}`);
  }

  async complete(taskId: string, params: CompleteTaskParams): Promise<Task> {
    return this.client.post<Task>(`/v1/tasks/${encodeURIComponent(taskId)}/complete`, params);
  }

  async dispute(taskId: string, params: DisputeTaskParams): Promise<Task> {
    return this.client.post<Task>(`/v1/tasks/${encodeURIComponent(taskId)}/dispute`, params);
  }
}
