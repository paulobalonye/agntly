import { eq, sql, desc } from 'drizzle-orm';
import type { DbConnection } from '@agntly/shared';
import { withdrawals } from '../db/schema.js';

export interface WithdrawalRow {
  readonly id: string;
  readonly walletId: string;
  readonly amount: string;
  readonly destination: string;
  readonly fee: string;
  readonly txHash: string | null;
  readonly status: string;
  readonly createdAt: Date;
}

export class WithdrawalRepository {
  constructor(private readonly db: DbConnection) {}

  async create(data: {
    walletId: string;
    amount: string;
    destination: string;
    fee: string;
  }): Promise<WithdrawalRow> {
    const [row] = await this.db
      .insert(withdrawals)
      .values({
        walletId: data.walletId,
        amount: data.amount,
        destination: data.destination,
        fee: data.fee,
        status: 'queued',
      })
      .returning();
    return row as unknown as WithdrawalRow;
  }

  async findById(id: string): Promise<WithdrawalRow | null> {
    const [row] = await this.db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.id, id))
      .limit(1);
    return (row as unknown as WithdrawalRow) ?? null;
  }

  async findByWalletId(
    walletId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ rows: readonly WithdrawalRow[]; total: number }> {
    const rows = await this.db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.walletId, walletId))
      .orderBy(desc(withdrawals.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(withdrawals)
      .where(eq(withdrawals.walletId, walletId));

    return {
      rows: rows as unknown as WithdrawalRow[],
      total: countResult?.count ?? 0,
    };
  }

  /**
   * Atomic CAS: queued → processing. Only first processor wins.
   */
  async markProcessing(id: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE withdrawals
      SET status = 'processing'
      WHERE id = ${id}::uuid
        AND status = 'queued'
      RETURNING id
    `);
    return (result.rows?.length ?? 0) > 0;
  }

  /**
   * Atomic CAS: processing → completed with txHash.
   */
  async markCompleted(id: string, txHash: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE withdrawals
      SET status = 'completed', tx_hash = ${txHash}
      WHERE id = ${id}::uuid
        AND status = 'processing'
      RETURNING id
    `);
    return (result.rows?.length ?? 0) > 0;
  }

  /**
   * Atomic CAS: processing → failed.
   */
  async markFailed(id: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE withdrawals
      SET status = 'failed'
      WHERE id = ${id}::uuid
        AND status = 'processing'
      RETURNING id
    `);
    return (result.rows?.length ?? 0) > 0;
  }
}
