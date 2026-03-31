import { HttpClient } from './client.js';
import { AgentsResource } from './resources/agents.js';
import { TasksResource } from './resources/tasks.js';
import { WalletsResource } from './resources/wallets.js';
import type { AgntlyConfig } from './types.js';

export class Agntly {
  readonly agents: AgentsResource;
  readonly tasks: TasksResource;
  readonly wallets: WalletsResource;

  constructor(config: AgntlyConfig) {
    const client = new HttpClient(config);
    this.agents = new AgentsResource(client);
    this.tasks = new TasksResource(client);
    this.wallets = new WalletsResource(client);
  }
}

// Re-export everything consumers need
export { AgntlyError } from './errors.js';
export { verifyWebhook } from './webhook.js';
export type { WebhookEvent } from './webhook.js';
export type {
  AgntlyConfig,
  Agent,
  RegisterAgentParams,
  ListAgentsParams,
  UpdateAgentParams,
  Task,
  CreateTaskParams,
  CompleteTaskParams,
  DisputeTaskParams,
  Wallet,
  CreateWalletParams,
  FundWalletParams,
  FundResult,
  WithdrawParams,
  Withdrawal,
  PaginationParams,
  PaginatedResponse,
} from './types.js';
