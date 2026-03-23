import { sql } from 'drizzle-orm';
import type { DbConnection } from '@agntly/shared';

export interface SpendingPolicy {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly perTransactionMax: string | null;
  readonly dailyBudget: string | null;
  readonly monthlyBudget: string | null;
  readonly lifetimeBudget: string | null;
  readonly allowedCategories: string[];
  readonly blockedAgentIds: string[];
  readonly maxPricePerCall: string | null;
  readonly verifiedOnly: boolean;
  readonly cooldownSeconds: number;
  readonly active: boolean;
  readonly createdAt: string;
}

export interface PolicyViolation {
  readonly allowed: false;
  readonly reason: string;
  readonly code: string;
}

export interface PolicyPass {
  readonly allowed: true;
}

export type PolicyCheckResult = PolicyPass | PolicyViolation;

function mapRow(row: Record<string, unknown>): SpendingPolicy {
  return {
    id: String(row.id ?? ''),
    ownerId: String(row.owner_id ?? ''),
    name: String(row.name ?? ''),
    perTransactionMax: row.per_transaction_max ? String(row.per_transaction_max) : null,
    dailyBudget: row.daily_budget ? String(row.daily_budget) : null,
    monthlyBudget: row.monthly_budget ? String(row.monthly_budget) : null,
    lifetimeBudget: row.lifetime_budget ? String(row.lifetime_budget) : null,
    allowedCategories: (row.allowed_categories as string[]) ?? [],
    blockedAgentIds: (row.blocked_agent_ids as string[]) ?? [],
    maxPricePerCall: row.max_price_per_call ? String(row.max_price_per_call) : null,
    verifiedOnly: Boolean(row.verified_only),
    cooldownSeconds: Number(row.cooldown_seconds ?? 0),
    active: Boolean(row.active),
    createdAt: String(row.created_at ?? ''),
  };
}

export class PolicyService {
  // In-memory cache for last task timestamps (cooldown tracking)
  private lastTaskTime = new Map<string, number>();

  constructor(
    private readonly db: DbConnection,
    private readonly redis?: { get: (key: string) => Promise<string | null>; incrbyfloat: (key: string, amount: number) => Promise<string>; expire: (key: string, seconds: number) => Promise<number> },
  ) {}

  async createPolicy(ownerId: string, data: {
    name: string;
    perTransactionMax?: string;
    dailyBudget?: string;
    monthlyBudget?: string;
    lifetimeBudget?: string;
    allowedCategories?: string[];
    blockedAgentIds?: string[];
    maxPricePerCall?: string;
    verifiedOnly?: boolean;
    cooldownSeconds?: number;
  }): Promise<SpendingPolicy> {
    const result = await this.db.execute(sql`
      INSERT INTO spending_policies (
        owner_id, name, per_transaction_max, daily_budget, monthly_budget, lifetime_budget,
        allowed_categories, blocked_agent_ids, max_price_per_call, verified_only, cooldown_seconds
      ) VALUES (
        ${ownerId}::uuid, ${data.name},
        ${data.perTransactionMax ?? null}, ${data.dailyBudget ?? null},
        ${data.monthlyBudget ?? null}, ${data.lifetimeBudget ?? null},
        ${data.allowedCategories ?? []}, ${data.blockedAgentIds ?? []},
        ${data.maxPricePerCall ?? null}, ${data.verifiedOnly ?? false},
        ${data.cooldownSeconds ?? 0}
      )
      RETURNING *
    `);
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  async getPolicy(policyId: string): Promise<SpendingPolicy | null> {
    const result = await this.db.execute(sql`
      SELECT * FROM spending_policies WHERE id = ${policyId}::uuid LIMIT 1
    `);
    if (!result.rows || result.rows.length === 0) return null;
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  async getActivePolicy(ownerId: string): Promise<SpendingPolicy | null> {
    const result = await this.db.execute(sql`
      SELECT * FROM spending_policies WHERE owner_id = ${ownerId}::uuid AND active = TRUE
      ORDER BY created_at DESC LIMIT 1
    `);
    if (!result.rows || result.rows.length === 0) return null;
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  async listPolicies(ownerId: string): Promise<SpendingPolicy[]> {
    const result = await this.db.execute(sql`
      SELECT * FROM spending_policies WHERE owner_id = ${ownerId}::uuid ORDER BY created_at DESC
    `);
    return (result.rows as Record<string, unknown>[]).map(mapRow);
  }

  async updatePolicy(policyId: string, ownerId: string, data: Record<string, unknown>): Promise<SpendingPolicy | null> {
    const existing = await this.getPolicy(policyId);
    if (!existing || existing.ownerId !== ownerId) return null;

    await this.db.execute(sql`
      UPDATE spending_policies SET
        name = ${(data.name as string) ?? existing.name},
        per_transaction_max = ${(data.perTransactionMax as string) ?? existing.perTransactionMax},
        daily_budget = ${(data.dailyBudget as string) ?? existing.dailyBudget},
        monthly_budget = ${(data.monthlyBudget as string) ?? existing.monthlyBudget},
        lifetime_budget = ${(data.lifetimeBudget as string) ?? existing.lifetimeBudget},
        allowed_categories = ${(data.allowedCategories as string[]) ?? existing.allowedCategories},
        blocked_agent_ids = ${(data.blockedAgentIds as string[]) ?? existing.blockedAgentIds},
        max_price_per_call = ${(data.maxPricePerCall as string) ?? existing.maxPricePerCall},
        verified_only = ${(data.verifiedOnly as boolean) ?? existing.verifiedOnly},
        cooldown_seconds = ${(data.cooldownSeconds as number) ?? existing.cooldownSeconds},
        active = ${(data.active as boolean) ?? existing.active},
        updated_at = NOW()
      WHERE id = ${policyId}::uuid
    `);

    return this.getPolicy(policyId);
  }

  async deletePolicy(policyId: string, ownerId: string): Promise<boolean> {
    const existing = await this.getPolicy(policyId);
    if (!existing || existing.ownerId !== ownerId) return false;
    await this.db.execute(sql`DELETE FROM spending_policies WHERE id = ${policyId}::uuid`);
    return true;
  }

  /**
   * Check if a task is allowed by the user's active policy.
   * Returns { allowed: true } or { allowed: false, reason, code }.
   */
  async checkPolicy(
    userId: string,
    agentId: string,
    agentCategory: string,
    agentPrice: string,
    agentVerified: boolean,
  ): Promise<PolicyCheckResult> {
    const policy = await this.getActivePolicy(userId);

    // No policy = no restrictions
    if (!policy) return { allowed: true };

    const price = parseFloat(agentPrice);

    // 1. Per-transaction max
    if (policy.perTransactionMax) {
      const max = parseFloat(policy.perTransactionMax);
      if (price > max) {
        return {
          allowed: false,
          reason: `Transaction amount $${agentPrice} exceeds per-transaction limit of $${policy.perTransactionMax}`,
          code: 'PER_TRANSACTION_EXCEEDED',
        };
      }
    }

    // 2. Max price per call
    if (policy.maxPricePerCall) {
      const max = parseFloat(policy.maxPricePerCall);
      if (price > max) {
        return {
          allowed: false,
          reason: `Agent price $${agentPrice} exceeds max price per call of $${policy.maxPricePerCall}`,
          code: 'MAX_PRICE_EXCEEDED',
        };
      }
    }

    // 3. Allowed categories
    if (policy.allowedCategories.length > 0 && !policy.allowedCategories.includes(agentCategory)) {
      return {
        allowed: false,
        reason: `Agent category '${agentCategory}' not in allowed list [${policy.allowedCategories.join(', ')}]`,
        code: 'CATEGORY_NOT_ALLOWED',
      };
    }

    // 4. Blocked agents
    if (policy.blockedAgentIds.length > 0 && policy.blockedAgentIds.includes(agentId)) {
      return {
        allowed: false,
        reason: `Agent '${agentId}' is in the blocked list`,
        code: 'AGENT_BLOCKED',
      };
    }

    // 5. Verified only
    if (policy.verifiedOnly && !agentVerified) {
      return {
        allowed: false,
        reason: `Policy requires verified agents only. Agent '${agentId}' is not verified`,
        code: 'VERIFIED_ONLY',
      };
    }

    // 6. Cooldown
    if (policy.cooldownSeconds > 0) {
      const lastTime = this.lastTaskTime.get(userId) ?? 0;
      const elapsed = (Date.now() - lastTime) / 1000;
      if (elapsed < policy.cooldownSeconds) {
        const remaining = Math.ceil(policy.cooldownSeconds - elapsed);
        return {
          allowed: false,
          reason: `Cooldown not elapsed (${remaining}s remaining of ${policy.cooldownSeconds}s)`,
          code: 'COOLDOWN_ACTIVE',
        };
      }
    }

    // 7. Daily budget
    if (policy.dailyBudget && this.redis) {
      const today = new Date().toISOString().slice(0, 10);
      const key = `spend:${userId}:daily:${today}`;
      const spent = parseFloat((await this.redis.get(key)) ?? '0');
      if (spent + price > parseFloat(policy.dailyBudget)) {
        return {
          allowed: false,
          reason: `Daily budget exceeded ($${spent.toFixed(2)} of $${policy.dailyBudget} used, task would add $${agentPrice})`,
          code: 'DAILY_BUDGET_EXCEEDED',
        };
      }
    }

    // 8. Monthly budget
    if (policy.monthlyBudget && this.redis) {
      const month = new Date().toISOString().slice(0, 7);
      const key = `spend:${userId}:monthly:${month}`;
      const spent = parseFloat((await this.redis.get(key)) ?? '0');
      if (spent + price > parseFloat(policy.monthlyBudget)) {
        return {
          allowed: false,
          reason: `Monthly budget exceeded ($${spent.toFixed(2)} of $${policy.monthlyBudget} used)`,
          code: 'MONTHLY_BUDGET_EXCEEDED',
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Record a spend after successful escrow lock.
   */
  async recordSpend(userId: string, amount: string): Promise<void> {
    this.lastTaskTime.set(userId, Date.now());

    if (!this.redis) return;

    const price = parseFloat(amount);
    const today = new Date().toISOString().slice(0, 10);
    const month = new Date().toISOString().slice(0, 7);

    const dailyKey = `spend:${userId}:daily:${today}`;
    const monthlyKey = `spend:${userId}:monthly:${month}`;

    await this.redis.incrbyfloat(dailyKey, price);
    await this.redis.expire(dailyKey, 172800); // 48 hours

    await this.redis.incrbyfloat(monthlyKey, price);
    await this.redis.expire(monthlyKey, 3024000); // 35 days
  }
}
