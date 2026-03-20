import { eq, and, isNull, sql } from 'drizzle-orm';
import type { DbConnection } from '@agntly/shared';
import { apiKeys } from '../db/schema.js';

export interface ApiKeyRow {
  readonly id: string;
  readonly userId: string;
  readonly keyHash: string;
  readonly prefix: string;
  readonly label: string;
  readonly lastUsedAt: Date | null;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
}

export class ApiKeyRepository {
  constructor(private readonly db: DbConnection) {}

  async create(data: {
    userId: string;
    keyHash: string;
    prefix: string;
    label: string;
  }): Promise<ApiKeyRow> {
    const [row] = await this.db
      .insert(apiKeys)
      .values({
        userId: data.userId,
        keyHash: data.keyHash,
        prefix: data.prefix,
        label: data.label,
      })
      .returning();
    return row as ApiKeyRow;
  }

  async findByKeyHash(keyHash: string): Promise<ApiKeyRow | null> {
    const [row] = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
      .limit(1);
    return (row as ApiKeyRow) ?? null;
  }

  async findByUserId(userId: string): Promise<readonly ApiKeyRow[]> {
    const rows = await this.db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));
    return rows as ApiKeyRow[];
  }

  async revoke(id: string, userId: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE api_keys
      SET revoked_at = NOW()
      WHERE id = ${id}::uuid
        AND user_id = ${userId}::uuid
        AND revoked_at IS NULL
      RETURNING id
    `);
    return (result.rows?.length ?? 0) > 0;
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.db.execute(sql`
      UPDATE api_keys
      SET last_used_at = NOW()
      WHERE id = ${id}::uuid
    `);
  }
}
