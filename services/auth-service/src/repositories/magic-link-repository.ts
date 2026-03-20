import { eq, sql } from 'drizzle-orm';
import type { DbConnection } from '@agntly/shared';
import { magicLinkTokens } from '../db/magic-link-schema.js';

export interface MagicLinkTokenRow {
  readonly id: string;
  readonly email: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
  readonly createdAt: Date;
}

export class MagicLinkRepository {
  constructor(private readonly db: DbConnection) {}

  async create(data: {
    email: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<MagicLinkTokenRow> {
    const [row] = await this.db
      .insert(magicLinkTokens)
      .values({
        email: data.email,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      })
      .returning();
    return row as MagicLinkTokenRow;
  }

  async findByTokenHash(tokenHash: string): Promise<MagicLinkTokenRow | null> {
    const [row] = await this.db
      .select()
      .from(magicLinkTokens)
      .where(eq(magicLinkTokens.tokenHash, tokenHash))
      .limit(1);
    return (row as MagicLinkTokenRow) ?? null;
  }

  /**
   * Atomic CAS: marks token as used only if it hasn't been used yet and hasn't expired.
   * Returns the id of the updated row, or null if conditions weren't met.
   */
  async markUsed(tokenHash: string): Promise<string | null> {
    const result = await this.db.execute(sql`
      UPDATE magic_link_tokens
      SET used_at = NOW()
      WHERE token_hash = ${tokenHash}
        AND used_at IS NULL
        AND expires_at > NOW()
      RETURNING id
    `);
    const row = result.rows?.[0] as { id: string } | undefined;
    return row?.id ?? null;
  }

  /**
   * Counts magic link send attempts for a given email within the specified window.
   * Used for rate limiting across multiple service instances.
   */
  async countRecentByEmail(email: string, windowMs: number): Promise<number> {
    const windowStart = new Date(Date.now() - windowMs);
    const result = await this.db.execute(sql`
      SELECT count(*) AS cnt
      FROM magic_link_tokens
      WHERE email = ${email}
        AND created_at > ${windowStart.toISOString()}
    `);
    const row = result.rows?.[0] as { cnt: string } | undefined;
    return parseInt(row?.cnt ?? '0', 10);
  }

  /**
   * Deletes expired and already-used tokens to prevent unbounded table growth.
   */
  async deleteExpired(): Promise<number> {
    const result = await this.db.execute(sql`
      DELETE FROM magic_link_tokens
      WHERE expires_at < NOW()
         OR used_at IS NOT NULL
      RETURNING id
    `);
    return result.rows?.length ?? 0;
  }
}
