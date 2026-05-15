import { eq, sql } from 'drizzle-orm';
import type { DbConnection } from '@agntly/shared';
import { escrows, escrowAuditLog } from '../db/schema.js';

export interface EscrowRow {
  readonly id: string;
  readonly taskId: string;
  readonly fromWalletId: string;
  readonly toWalletId: string;
  readonly amount: string;
  readonly fee: string;
  readonly state: 'locked' | 'released' | 'refunded' | 'disputed';
  readonly txHash: string | null;
  readonly resultHash: string | null;
  readonly disputeReason: string | null;
  readonly disputeEvidence: string | null;
  readonly deadline: Date;
  readonly createdAt: Date;
  readonly settledAt: Date | null;
}

export class EscrowRepository {
  constructor(private readonly db: DbConnection) {}

  async create(data: {
    taskId: string;
    fromWalletId: string;
    toWalletId: string;
    amount: string;
    fee: string;
    txHash?: string;
    deadline: Date;
  }): Promise<EscrowRow> {
    const [row] = await this.db
      .insert(escrows)
      .values({
        taskId: data.taskId,
        fromWalletId: data.fromWalletId,
        toWalletId: data.toWalletId,
        amount: data.amount,
        fee: data.fee,
        txHash: data.txHash ?? null,
        deadline: data.deadline,
      })
      .returning();
    return row as EscrowRow;
  }

  async findById(id: string): Promise<EscrowRow | null> {
    const [row] = await this.db
      .select()
      .from(escrows)
      .where(eq(escrows.id, id))
      .limit(1);
    return (row as EscrowRow) ?? null;
  }

  async findByTaskId(taskId: string): Promise<EscrowRow | null> {
    const [row] = await this.db
      .select()
      .from(escrows)
      .where(eq(escrows.taskId, taskId))
      .limit(1);
    return (row as EscrowRow) ?? null;
  }

  /**
   * Atomically transition state from fromState to toState.
   * Uses raw SQL UPDATE with WHERE state = fromState to prevent race conditions.
   * Returns null if the escrow was not in the expected state.
   */
  async transition(
    escrowId: string,
    fromState: EscrowRow['state'],
    toState: EscrowRow['state'],
    extra?: {
      resultHash?: string;
      disputeReason?: string;
    },
  ): Promise<EscrowRow | null> {
    // Build optional SET fragments using parameterized sql template
    const resultHashClause =
      extra?.resultHash !== undefined
        ? sql`, result_hash = ${extra.resultHash}`
        : sql``;

    const disputeReasonClause =
      extra?.disputeReason !== undefined
        ? sql`, dispute_reason = ${extra.disputeReason}`
        : sql``;

    const settledAtClause =
      toState === 'released' || toState === 'refunded'
        ? sql`, settled_at = NOW()`
        : sql``;

    const result = await this.db.execute(sql`
      UPDATE escrows
      SET
        state = ${toState}::escrow_state
        ${settledAtClause}
        ${resultHashClause}
        ${disputeReasonClause}
      WHERE id = ${escrowId}::uuid
        AND state = ${fromState}::escrow_state
      RETURNING id
    `);

    if ((result.rows?.length ?? 0) === 0) {
      return null;
    }

    return this.findById(escrowId);
  }

  async getWalletBalance(walletId: string): Promise<string | null> {
    const result = await this.db.execute(
      sql`SELECT balance FROM wallets WHERE id = ${walletId}::uuid LIMIT 1`,
    );
    const row = result.rows?.[0] as { balance?: string } | undefined;
    return row?.balance ?? null;
  }

  async addAuditEntry(data: {
    escrowId: string;
    action: string;
    actor: string;
    details?: string;
  }): Promise<void> {
    await this.db
      .insert(escrowAuditLog)
      .values({
        escrowId: data.escrowId,
        action: data.action,
        actor: data.actor,
        details: data.details ?? null,
      });
  }
}
