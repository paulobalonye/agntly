import type { HttpClient } from '../client.js';
import type {
  Agent,
  RegisterAgentParams,
  ListAgentsParams,
  UpdateAgentParams,
  PaginatedResponse,
} from '../types.js';

export class AgentsResource {
  constructor(private readonly client: HttpClient) {}

  async register(params: RegisterAgentParams): Promise<Agent> {
    return this.client.post<Agent>('/v1/agents', params);
  }

  async list(params?: ListAgentsParams): Promise<PaginatedResponse<Agent>> {
    return this.client.getPaginated<Agent>('/v1/agents', params as Record<string, string | number | undefined>);
  }

  async get(agentId: string): Promise<Agent> {
    return this.client.get<Agent>(`/v1/agents/${encodeURIComponent(agentId)}`);
  }

  async update(agentId: string, params: UpdateAgentParams): Promise<Agent> {
    return this.client.put<Agent>(`/v1/agents/${encodeURIComponent(agentId)}`, params);
  }

  async delist(agentId: string): Promise<{ delisted: boolean }> {
    return this.client.del<{ delisted: boolean }>(`/v1/agents/${encodeURIComponent(agentId)}`);
  }
}
