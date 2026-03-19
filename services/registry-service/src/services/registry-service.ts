import { generateId } from '@agntly/shared';
import type { Agent } from '@agntly/shared';

const agents = new Map<string, Agent>();

// Seed demo agents matching marketplace.html
const seedAgents: Agent[] = [
  { id: 'ws-alpha-v3', ownerId: 'seed', walletId: 'wal-seed-1', name: 'WebSearch Alpha', description: 'High-speed web search with real-time indexing. Returns structured JSON with sources, snippets, and confidence scores.', endpoint: 'https://demo.agntly.io/ws', priceUsdc: '0.002000', category: 'search', tags: ['REST', 'JSON', 'RAG-ready', 'streaming'], status: 'active', verified: true, reputation: 4.97, callsTotal: 18492, uptimePct: 99.9, timeoutMs: 30000, featuredUntil: new Date('2026-12-31'), createdAt: new Date() },
  { id: 'code-exec-pro', ownerId: 'seed', walletId: 'wal-seed-2', name: 'CodeExec Pro', description: 'Sandboxed Python/JS/Rust execution environment. Returns stdout, stderr, and exit codes. Isolated per task.', endpoint: 'https://demo.agntly.io/ce', priceUsdc: '0.005000', category: 'code', tags: ['Python', 'JS', 'Rust', 'sandboxed'], status: 'active', verified: true, reputation: 4.92, callsTotal: 7841, uptimePct: 99.7, timeoutMs: 60000, featuredUntil: null, createdAt: new Date() },
  { id: 'pdf-parser-nx', ownerId: 'seed', walletId: 'wal-seed-3', name: 'PDFParser NX', description: 'Extract structured data from PDFs — tables, forms, OCR text. Returns markdown + raw JSON schema.', endpoint: 'https://demo.agntly.io/pp', priceUsdc: '0.001000', category: 'file', tags: ['OCR', 'tables', 'forms', 'markdown'], status: 'active', verified: true, reputation: 4.85, callsTotal: 24100, uptimePct: 98.4, timeoutMs: 30000, featuredUntil: null, createdAt: new Date() },
  { id: 'data-wrangler-v2', ownerId: 'seed', walletId: 'wal-seed-4', name: 'DataWrangler v2', description: 'Clean, transform, and normalize tabular data. Handles CSV, JSON, Parquet. Returns schema diff + clean dataset.', endpoint: 'https://demo.agntly.io/dw', priceUsdc: '0.003000', category: 'data', tags: ['CSV', 'Parquet', 'JSON', 'schema'], status: 'active', verified: false, reputation: 4.78, callsTotal: 5920, uptimePct: 99.5, timeoutMs: 30000, featuredUntil: null, createdAt: new Date() },
  { id: 'api-relay-turbo', ownerId: 'seed', walletId: 'wal-seed-5', name: 'API Relay Turbo', description: 'Authenticated API proxy agent. Manages OAuth, retries, rate limits. Supports 200+ public APIs out of the box.', endpoint: 'https://demo.agntly.io/ar', priceUsdc: '0.001500', category: 'api', tags: ['OAuth', 'retry', 'rate-limit', '200+ APIs'], status: 'active', verified: true, reputation: 4.95, callsTotal: 31882, uptimePct: 99.8, timeoutMs: 15000, featuredUntil: new Date('2026-12-31'), createdAt: new Date() },
  { id: 'summarizer-ctx', ownerId: 'seed', walletId: 'wal-seed-6', name: 'Summarizer CTX', description: 'Long-context summarization up to 200k tokens. Returns tiered summaries: TL;DR, key points, and full summary.', endpoint: 'https://demo.agntly.io/sc', priceUsdc: '0.004000', category: 'llm', tags: ['200k ctx', 'tiered', 'multi-doc', 'streaming'], status: 'active', verified: false, reputation: 4.88, callsTotal: 4201, uptimePct: 99.6, timeoutMs: 60000, featuredUntil: null, createdAt: new Date() },
];

for (const agent of seedAgents) {
  agents.set(agent.id, agent);
}

export class RegistryService {
  async registerAgent(ownerId: string, data: { agentId: string; name: string; description: string; endpoint: string; priceUsdc: string; category: string; tags?: string[]; timeoutMs?: number }): Promise<Agent> {
    const agent: Agent = {
      id: data.agentId, ownerId, walletId: generateId('wal'), name: data.name, description: data.description,
      endpoint: data.endpoint, priceUsdc: data.priceUsdc, category: data.category, tags: data.tags ?? [],
      status: 'active', verified: false, reputation: 0, callsTotal: 0, uptimePct: 100, timeoutMs: data.timeoutMs ?? 30000,
      featuredUntil: null, createdAt: new Date(),
    };
    agents.set(agent.id, agent);
    return agent;
  }

  async listAgents(query: Record<string, string>): Promise<readonly Agent[]> {
    let results = Array.from(agents.values()).filter((a) => a.status !== 'delisted');

    if (query.category) results = results.filter((a) => a.category === query.category);
    if (query.verified === 'true') results = results.filter((a) => a.verified);
    if (query.status) results = results.filter((a) => a.status === query.status);
    if (query.maxPrice) results = results.filter((a) => parseFloat(a.priceUsdc) <= parseFloat(query.maxPrice));
    if (query.q) {
      const q = query.q.toLowerCase();
      results = results.filter((a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
    }

    const sort = query.sort ?? 'volume';
    if (sort === 'volume') results.sort((a, b) => b.callsTotal - a.callsTotal);
    else if (sort === 'price') results.sort((a, b) => parseFloat(a.priceUsdc) - parseFloat(b.priceUsdc));
    else if (sort === 'rating') results.sort((a, b) => b.reputation - a.reputation);
    else if (sort === 'newest') results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const page = parseInt(query.page ?? '1');
    const limit = parseInt(query.limit ?? '20');
    return results.slice((page - 1) * limit, page * limit);
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    return agents.get(agentId) ?? null;
  }

  async updateAgent(agentId: string, updates: Record<string, unknown>): Promise<Agent> {
    const agent = agents.get(agentId);
    if (!agent) throw new Error('Agent not found');
    const updated: Agent = {
      ...agent,
      ...(updates.priceUsdc ? { priceUsdc: updates.priceUsdc as string } : {}),
      ...(updates.endpoint ? { endpoint: updates.endpoint as string } : {}),
      ...(updates.status ? { status: updates.status as 'active' | 'paused' } : {}),
    };
    agents.set(agentId, updated);
    return updated;
  }

  async delistAgent(agentId: string): Promise<void> {
    const agent = agents.get(agentId);
    if (!agent) throw new Error('Agent not found');
    agents.set(agentId, { ...agent, status: 'delisted' });
  }
}
