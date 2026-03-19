import { eq, sql, desc } from 'drizzle-orm';
import type { DbConnection } from '@agntly/shared';
import { payments } from '../db/schema.js';

export interface PaymentRow {
  readonly id: string;
  readonly userId: string;
  readonly walletId: string;
  readonly amountUsd: string;
  readonly usdcAmount: string | null;
  readonly method: string;
  readonly stripeSessionId: string | null;
  readonly status: string;
  readonly failureReason: string | null;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
}

export class PaymentRepository {
  constructor(private readonly db: DbConnection) {}

  async create(data: {
    userId: string;
    walletId: string;
    amountUsd: string;
    method: string;
    stripeSessionId: string;
  }): Promise<PaymentRow> {
    const [row] = await this.db
      .insert(payments)
      .values({
        userId: data.userId,
        walletId: data.walletId,
        amountUsd: data.amountUsd,
        method: data.method,
        stripeSessionId: data.stripeSessionId,
        status: 'pending',
      })
      .returning();
    return row as unknown as PaymentRow;
  }

  async findById(id: string): Promise<PaymentRow | null> {
    const [row] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1);
    return (row as unknown as PaymentRow) ?? null;
  }

  async findByStripeSessionId(sessionId: string): Promise<PaymentRow | null> {
    const [row] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.stripeSessionId, sessionId))
      .limit(1);
    return (row as unknown as PaymentRow) ?? null;
  }

  async findByUserId(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ rows: readonly PaymentRow[]; total: number }> {
    const rows = await this.db
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(payments)
      .where(eq(payments.userId, userId));

    return {
      rows: rows as unknown as PaymentRow[],
      total: countResult?.count ?? 0,
    };
  }

  /**
   * Atomic CAS: mark payment as completed ONLY if currently pending.
   * Returns the payment ID if transition succeeded, null if already completed.
   * This is the idempotency guard for webhook processing.
   */
  async markCompleted(stripeSessionId: string, usdcAmount: string): Promise<string | null> {
    const result = await this.db.execute(sql`
      UPDATE payments
      SET
        status = 'completed',
        usdc_amount = ${usdcAmount}::numeric,
        completed_at = NOW()
      WHERE stripe_session_id = ${stripeSessionId}
        AND status = 'pending'
      RETURNING id
    `);
    const row = result.rows?.[0] as { id: string } | undefined;
    return row?.id ?? null;
  }

  /**
   * Atomic: mark payment as failed ONLY if currently pending.
   */
  async markFailed(id: string, reason: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE payments
      SET
        status = 'failed',
        failure_reason = ${reason}
      WHERE id = ${id}::uuid
        AND status = 'pending'
      RETURNING id
    `);
    return (result.rows?.length ?? 0) > 0;
  }
}
