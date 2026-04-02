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

export class RegistryService {
  constructor(private readonly db: DbConnection) {}

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

  /**
   * Update agent stats after a task completion.
   * Increments calls_total, updates avg_latency_ms (rolling average), and
   * recalculates reputation based on completion ratio.
   */
  async recordTaskCompletion(agentId: string, latencyMs: number | null): Promise<void> {
    // Atomic update: increment calls, rolling avg latency, bump reputation toward 5.0
    await this.db.execute(sql`
      UPDATE agents
      SET
        calls_total = calls_total + 1,
        calls_last_24h = calls_last_24h + 1,
        avg_latency_ms = CASE
          WHEN ${latencyMs} IS NOT NULL AND calls_total > 0
          THEN ((avg_latency_ms * calls_total) + ${latencyMs ?? 0}) / (calls_total + 1)
          ELSE avg_latency_ms
        END,
        reputation = LEAST(
          ROUND((reputation * calls_total + 4.5) / (calls_total + 1), 2),
          5.00
        ),
        updated_at = NOW()
      WHERE id = ${agentId}
    `);
  }
}
