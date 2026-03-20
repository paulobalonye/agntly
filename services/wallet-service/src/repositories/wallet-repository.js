import { eq, sql } from 'drizzle-orm';
import { wallets } from '../db/schema.js';
export class WalletRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    async create(data) {
        const [row] = await this.db
            .insert(wallets)
            .values({
            ownerId: data.ownerId,
            agentId: data.agentId ?? null,
            address: data.address,
            chain: data.chain ?? 'base-sepolia',
        })
            .returning();
        return row;
    }
    async findById(id) {
        const [row] = await this.db
            .select()
            .from(wallets)
            .where(eq(wallets.id, id))
            .limit(1);
        return row ?? null;
    }
    /**
     * Lock funds: atomically move from available (balance) to reserved (locked).
     * Guard: balance >= amount (NOT balance - locked, which double-counts).
     */
    async lockFunds(walletId, amount) {
        const result = await this.db.execute(sql `
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
    async releaseFunds(fromWalletId, toWalletId, grossAmount, netAmount) {
        const result = await this.db.execute(sql `
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
      )
      SELECT
        (SELECT count(*) FROM deducted) AS deducted_count,
        (SELECT count(*) FROM credited) AS credited_count
    `);
        const row = result.rows?.[0];
        return row?.deducted_count === '1' && row?.credited_count === '1';
    }
    /**
     * Refund locked funds back to available balance.
     */
    async refundFunds(walletId, amount) {
        const result = await this.db.execute(sql `
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
    async creditBalance(walletId, amount) {
        const result = await this.db.execute(sql `
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
    async debitBalance(walletId, amount) {
        const result = await this.db.execute(sql `
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
//# sourceMappingURL=wallet-repository.js.map