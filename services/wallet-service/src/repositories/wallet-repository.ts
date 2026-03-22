import { eq, sql } from 'drizzle-orm';
import type { DbConnection } from '@agntly/shared';
import { wallets } from '../db/schema.js';

export interface WalletRow {
  readonly id: string;
  readonly ownerId: string;
  readonly agentId: string | null;
  readonly address: string;
  readonly balance: string;
  readonly locked: string;
  readonly chain: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class WalletRepository {
  constructor(private readonly db: DbConnection) {}

  async create(data: {
    ownerId: string;
    agentId?: string;
    address: string;
    chain?: string;
  }): Promise<WalletRow> {
    const [row] = await this.db
      .insert(wallets)
      .values({
        ownerId: data.ownerId,
        agentId: data.agentId ?? null,
        address: data.address,
        chain: data.chain ?? 'base-sepolia',
      })
      .returning();
    return row as WalletRow;
  }

  async findById(id: string): Promise<WalletRow | null> {
    const [row] = await this.db
      .select()
      .from(wallets)
      .where(eq(wallets.id, id))
      .limit(1);
    return (row as WalletRow) ?? null;
  }

  async findByOwner(ownerId: string): Promise<WalletRow | null> {
    const [row] = await this.db
      .select()
      .from(wallets)
      .where(eq(wallets.ownerId, ownerId))
      .limit(1);
    return (row as WalletRow) ?? null;
  }

  /**
   * Lock funds: atomically move from available (balance) to reserved (locked).
   * Guard: balance >= amount (NOT balance - locked, which double-counts).
   */
  async lockFunds(walletId: string, amount: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE wallets
      SET
        balance = balance - ${amount}::numeric,
        locked = locked + ${amount}::numeric,
        updated_at = NOW()
      WHERE id = ${walletId}::uuid
        AND balance >= ${amount}::numeric
      RETURNING id
    `);
    return (result.rows?.length ?? 0) > 0;
  }

  /**
   * Release locked funds to a destination wallet.
   * Verifies BOTH wallets exist before executing either UPDATE.
   * If either is missing, neither executes (no money destroyed).
   */
  async releaseFunds(
    fromWalletId: string,
    toWalletId: string,
    grossAmount: string,
    netAmount: string,
    treasuryWalletId?: string,
    feeAmount?: string,
  ): Promise<boolean> {
    // If treasury wallet provided, split payment: net → builder, fee → treasury
    const hasTreasury = treasuryWalletId && feeAmount && parseFloat(feeAmount) > 0;

    const result = await this.db.execute(sql`
      WITH source_check AS (
        SELECT id FROM wallets WHERE id = ${fromWalletId}::uuid AND locked >= ${grossAmount}::numeric
      ),
      dest_check AS (
        SELECT id FROM wallets WHERE id = ${toWalletId}::uuid
      ),
      deducted AS (
        UPDATE wallets
        SET
          locked = locked - ${grossAmount}::numeric,
          updated_at = NOW()
        WHERE id = ${fromWalletId}::uuid
          AND EXISTS (SELECT 1 FROM source_check)
          AND EXISTS (SELECT 1 FROM dest_check)
        RETURNING id
      ),
      credited AS (
        UPDATE wallets
        SET
          balance = balance + ${netAmount}::numeric,
          updated_at = NOW()
        WHERE id = ${toWalletId}::uuid
          AND EXISTS (SELECT 1 FROM deducted)
        RETURNING id
      ),
      fee_credited AS (
        UPDATE wallets
        SET
          balance = balance + ${hasTreasury ? feeAmount! : '0'}::numeric,
          updated_at = NOW()
        WHERE id = ${hasTreasury ? treasuryWalletId! : fromWalletId}::uuid
          AND ${hasTreasury ? sql`TRUE` : sql`FALSE`}
          AND EXISTS (SELECT 1 FROM deducted)
        RETURNING id
      )
      SELECT
        (SELECT count(*) FROM deducted) AS deducted_count,
        (SELECT count(*) FROM credited) AS credited_count
    `);
    const row = result.rows?.[0] as { deducted_count: string; credited_count: string } | undefined;
    return row?.deducted_count === '1' && row?.credited_count === '1';
  }

  /**
   * Refund locked funds back to available balance.
   */
  async refundFunds(walletId: string, amount: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE wallets
      SET
        balance = balance + ${amount}::numeric,
        locked = locked - ${amount}::numeric,
        updated_at = NOW()
      WHERE id = ${walletId}::uuid
        AND locked >= ${amount}::numeric
      RETURNING id
    `);
    return (result.rows?.length ?? 0) > 0;
  }

  /**
   * Credit wallet balance (for funding / deposits).
   */
  async creditBalance(walletId: string, amount: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE wallets
      SET
        balance = balance + ${amount}::numeric,
        updated_at = NOW()
      WHERE id = ${walletId}::uuid
      RETURNING id
    `);
    return (result.rows?.length ?? 0) > 0;
  }

  /**
   * Withdraw: atomically debit balance with guard.
   */
  async debitBalance(walletId: string, amount: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE wallets
      SET
        balance = balance - ${amount}::numeric,
        updated_at = NOW()
      WHERE id = ${walletId}::uuid
        AND balance >= ${amount}::numeric
      RETURNING id
    `);
    return (result.rows?.length ?? 0) > 0;
  }
}
