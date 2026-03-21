import { eq, sql, ilike, and, lte, desc, asc } from 'drizzle-orm';
import { generateId } from '@agntly/shared';
import type { DbConnection } from '@agntly/shared';
import { agents } from '../db/schema.js';

export interface AgentRow {
  readonly id: string;
  readonly ownerId: string;
  readonly walletId: string;
  readonly name: string;
  readonly description: string;
  readonly endpoint: string;
  readonly priceUsdc: string;
  readonly category: string;
  readonly tags: string[];
  readonly status: string;
  readonly verified: boolean;
  readonly reputation: string;
  readonly callsTotal: number;
  readonly uptimePct: string;
  readonly timeoutMs: number;
  readonly featuredUntil: Date | null;
  readonly createdAt: Date;
}

// Seed demo agents on first run (idempotent — skips if already exist)
const SEED_AGENTS = [
  { id: 'ws-alpha-v3', name: 'WebSearch Alpha', description: 'High-speed web search with real-time indexing. Returns structured JSON with sources, snippets, and confidence scores.', endpoint: 'https://demo.agntly.io/ws', priceUsdc: '0.002000', category: 'search', tags: ['REST', 'JSON', 'RAG-ready', 'streaming'], verified: true, callsTotal: 18492, uptimePct: '99.90', reputation: '4.97' },
  { id: 'code-exec-pro', name: 'CodeExec Pro', description: 'Sandboxed Python/JS/Rust execution environment. Returns stdout, stderr, and exit codes.', endpoint: 'https://demo.agntly.io/ce', priceUsdc: '0.005000', category: 'code', tags: ['Python', 'JS', 'Rust', 'sandboxed'], verified: true, callsTotal: 7841, uptimePct: '99.70', reputation: '4.92' },
  { id: 'pdf-parser-nx', name: 'PDFParser NX', description: 'Extract structured data from PDFs — tables, forms, OCR text. Returns markdown + raw JSON schema.', endpoint: 'https://demo.agntly.io/pp', priceUsdc: '0.001000', category: 'file', tags: ['OCR', 'tables', 'forms', 'markdown'], verified: true, callsTotal: 24100, uptimePct: '98.40', reputation: '4.85' },
  { id: 'data-wrangler-v2', name: 'DataWrangler v2', description: 'Clean, transform, and normalize tabular data. Handles CSV, JSON, Parquet.', endpoint: 'https://demo.agntly.io/dw', priceUsdc: '0.003000', category: 'data', tags: ['CSV', 'Parquet', 'JSON', 'schema'], verified: false, callsTotal: 5920, uptimePct: '99.50', reputation: '4.78' },
  { id: 'api-relay-turbo', name: 'API Relay Turbo', description: 'Authenticated API proxy agent. Manages OAuth, retries, rate limits. Supports 200+ public APIs.', endpoint: 'https://demo.agntly.io/ar', priceUsdc: '0.001500', category: 'api', tags: ['OAuth', 'retry', 'rate-limit', '200+ APIs'], verified: true, callsTotal: 31882, uptimePct: '99.80', reputation: '4.95' },
  { id: 'summarizer-ctx', name: 'Summarizer CTX', description: 'Long-context summarization up to 200k tokens. Returns tiered summaries.', endpoint: 'https://demo.agntly.io/sc', priceUsdc: '0.004000', category: 'llm', tags: ['200k ctx', 'tiered', 'multi-doc', 'streaming'], verified: false, callsTotal: 4201, uptimePct: '99.60', reputation: '4.88' },
];

export class RegistryService {
  constructor(private readonly db: DbConnection) {}

  async seedDemoAgents(): Promise<void> {
    for (const seed of SEED_AGENTS) {
      const existing = await this.getAgent(seed.id);
      if (!existing) {
        try {
          await this.db.insert(agents).values({
            id: seed.id,
            ownerId: '00000000-0000-0000-0000-000000000000',
            walletId: '00000000-0000-0000-0000-000000000000',
            name: seed.name,
            description: seed.description,
            endpoint: seed.endpoint,
            priceUsdc: seed.priceUsdc,
            category: seed.category,
            tags: seed.tags,
            verified: seed.verified,
            callsTotal: seed.callsTotal,
            uptimePct: seed.uptimePct,
            reputation: seed.reputation,
          });
        } catch {
          // Skip if already exists (race condition safe)
        }
      }
    }
  }

  async registerAgent(ownerId: string, data: {
    agentId: string;
    name: string;
    description: string;
    endpoint: string;
    priceUsdc: string;
    category: string;
    tags?: string[];
    timeoutMs?: number;
    walletId?: string;
  }): Promise<AgentRow> {
    const [row] = await this.db.insert(agents).values({
      id: data.agentId,
      ownerId,
      walletId: data.walletId ?? generateId('wal'),
      name: data.name,
      description: data.description,
      endpoint: data.endpoint,
      priceUsdc: data.priceUsdc,
      category: data.category,
      tags: data.tags ?? [],
      timeoutMs: data.timeoutMs ?? 30000,
    }).returning();

    // Fire-and-forget health check on registration
    this.checkAgentHealth(data.agentId, data.endpoint).catch(() => {});

    return row as AgentRow;
  }

  /**
   * Check if an agent endpoint is reachable.
   * Updates uptime_pct in the database.
   */
  async checkAgentHealth(agentId: string, endpoint?: string): Promise<boolean> {
    let url = endpoint;
    if (!url) {
      const agent = await this.getAgent(agentId);
      if (!agent) return false;
      url = agent.endpoint;
    }

    try {
      // Try POST /run with empty payload (standard agent interface)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: 'health-check', payload: {} }),
        signal: AbortSignal.timeout(10000),
      });

      const healthy = res.ok;

      // Update uptime — simple moving average approach
      await this.db.execute(sql`
        UPDATE agents
        SET uptime_pct = CASE
          WHEN ${healthy} THEN LEAST(uptime_pct + 0.1, 100.00)
          ELSE GREATEST(uptime_pct - 5.0, 0.00)
        END,
        updated_at = NOW()
        WHERE id = ${agentId}
      `);

      return healthy;
    } catch {
      // Endpoint unreachable — decrease uptime
      await this.db.execute(sql`
        UPDATE agents
        SET uptime_pct = GREATEST(uptime_pct - 5.0, 0.00),
            updated_at = NOW()
        WHERE id = ${agentId}
      `);
      return false;
    }
  }

  /**
   * Run health checks on all active agents.
   * Called periodically by the server.
   */
  async checkAllAgentsHealth(): Promise<{ checked: number; healthy: number; unhealthy: number }> {
    const activeAgents = await this.listAgents({ status: 'active' });
    let healthy = 0;
    let unhealthy = 0;

    for (const agent of activeAgents) {
      const ok = await this.checkAgentHealth(agent.id, agent.endpoint);
      if (ok) healthy++;
      else unhealthy++;
    }

    // Auto-pause agents with very low uptime (3 consecutive failures = ~85% drop)
    await this.db.execute(sql`
      UPDATE agents
      SET status = 'paused', updated_at = NOW()
      WHERE status = 'active' AND uptime_pct < 50.00
    `);

    return { checked: activeAgents.length, healthy, unhealthy };
  }

  async listAgents(query: Record<string, string>): Promise<readonly AgentRow[]> {
    // Build WHERE conditions
    const conditions = [sql`${agents.status} != 'delisted'`];
    if (query.category) conditions.push(eq(agents.category, query.category));
    if (query.verified === 'true') conditions.push(eq(agents.verified, true));
    if (query.status) conditions.push(eq(agents.status, query.status as 'active' | 'paused' | 'delisted'));
    if (query.maxPrice) conditions.push(lte(agents.priceUsdc, query.maxPrice));
    if (query.q) {
      const pattern = `%${query.q}%`;
      conditions.push(sql`(${agents.name} ILIKE ${pattern} OR ${agents.description} ILIKE ${pattern})`);
    }
    if (query.ownerId) conditions.push(eq(agents.ownerId, query.ownerId));

    // Sort
    const sort = query.sort ?? 'volume';
    const orderBy = sort === 'price' ? asc(agents.priceUsdc)
      : sort === 'rating' ? desc(agents.reputation)
      : sort === 'newest' ? desc(agents.createdAt)
      : desc(agents.callsTotal);

    // Paginate
    const page = parseInt(query.page ?? '1');
    const limit = Math.min(parseInt(query.limit ?? '20'), 100);

    const rows = await this.db
      .select()
      .from(agents)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset((page - 1) * limit);

    return rows as AgentRow[];
  }

  async getAgent(agentId: string): Promise<AgentRow | null> {
    const [row] = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);
    return (row as AgentRow) ?? null;
  }

  async updateAgent(agentId: string, updates: Record<string, unknown>): Promise<AgentRow> {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.priceUsdc !== undefined) values.priceUsdc = updates.priceUsdc;
    if (updates.endpoint !== undefined) values.endpoint = updates.endpoint;
    if (updates.status !== undefined) values.status = updates.status;
    if (updates.name !== undefined) values.name = updates.name;
    if (updates.description !== undefined) values.description = updates.description;

    const [row] = await this.db
      .update(agents)
      .set(values)
      .where(eq(agents.id, agentId))
      .returning();
    if (!row) throw new Error('Agent not found');
    return row as AgentRow;
  }

  async delistAgent(agentId: string): Promise<void> {
    const result = await this.db
      .update(agents)
      .set({ status: 'delisted', updatedAt: new Date() })
      .where(eq(agents.id, agentId))
      .returning();
    if (result.length === 0) throw new Error('Agent not found');
  }
}
