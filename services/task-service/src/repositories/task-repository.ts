import { eq, sql } from 'drizzle-orm';
import type { DbConnection } from '@agntly/shared';
import type { TaskStatus } from '@agntly/shared';
import { tasks, taskAuditLog } from '../db/schema.js';

export interface TaskRow {
  readonly id: string;
  readonly orchestratorId: string;
  readonly agentId: string;
  readonly payload: Record<string, unknown>;
  readonly result: Record<string, unknown> | null;
  readonly status: TaskStatus;
  readonly amount: string;
  readonly fee: string;
  readonly escrowTx: string | null;
  readonly settleTx: string | null;
  readonly deadline: Date;
  readonly latencyMs: number | null;
  readonly errorMessage: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
}

const VALID_TASK_STATUSES: readonly TaskStatus[] = [
  'pending',
  'escrowed',
  'dispatched',
  'complete',
  'failed',
  'disputed',
];

export class TaskRepository {
  constructor(private readonly db: DbConnection) {}

  async create(data: {
    id: string;
    orchestratorId: string;
    agentId: string;
    payload: Record<string, unknown>;
    amount: string;
    fee: string;
    deadline: Date;
  }): Promise<TaskRow> {
    const [row] = await this.db
      .insert(tasks)
      .values({
        id: data.id,
        orchestratorId: data.orchestratorId,
        agentId: data.agentId,
        payload: data.payload,
        amount: data.amount,
        fee: data.fee,
        deadline: data.deadline,
      })
      .returning();
    return row as TaskRow;
  }

  async findByUser(userId: string, limit = 50): Promise<TaskRow[]> {
    const rows = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.orchestratorId, userId))
      .orderBy(sql`created_at DESC`)
      .limit(limit);
    return rows as TaskRow[];
  }

  async findById(id: string): Promise<TaskRow | null> {
    const [row] = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);
    return (row as TaskRow) ?? null;
  }

  /**
   * Atomically transition task status, validating fromStates is a subset of known statuses.
   * Uses parameterized sql.join() instead of sql.raw() to safely embed the IN-list.
   * Returns null if the task was not in any of the expected states.
   */
  async transition(
    taskId: string,
    fromStates: readonly TaskStatus[],
    toState: TaskStatus,
    extra?: {
      result?: Record<string, unknown>;
      latencyMs?: number;
      escrowTx?: string;
      settleTx?: string;
      errorMessage?: string;
    },
  ): Promise<TaskRow | null> {
    // Validate fromStates against known enum values to avoid injection
    for (const s of fromStates) {
      if (!VALID_TASK_STATUSES.includes(s)) {
        throw new Error(`Invalid task status: ${s}`);
      }
    }

    const fromStatesList = sql.join(
      fromStates.map((s) => sql`${s}::task_status`),
      sql`, `,
    );

    const resultClause =
      extra?.result !== undefined
        ? sql`, result = ${JSON.stringify(extra.result)}::jsonb`
        : sql``;

    const latencyMsClause =
      extra?.latencyMs !== undefined
        ? sql`, latency_ms = ${extra.latencyMs}`
        : sql``;

    const escrowTxClause =
      extra?.escrowTx !== undefined
        ? sql`, escrow_tx = ${extra.escrowTx}`
        : sql``;

    const settleTxClause =
      extra?.settleTx !== undefined
        ? sql`, settle_tx = ${extra.settleTx}`
        : sql``;

    const errorMessageClause =
      extra?.errorMessage !== undefined
        ? sql`, error_message = ${extra.errorMessage}`
        : sql``;

    const completedAtClause =
      toState === 'complete' || toState === 'failed'
        ? sql`, completed_at = NOW()`
        : sql``;

    const result = await this.db.execute(sql`
      UPDATE tasks
      SET
        status = ${toState}::task_status
        ${resultClause}
        ${latencyMsClause}
        ${escrowTxClause}
        ${settleTxClause}
        ${errorMessageClause}
        ${completedAtClause}
      WHERE id = ${taskId}
        AND status IN (${fromStatesList})
      RETURNING id
    `);

    if ((result.rows?.length ?? 0) === 0) {
      return null;
    }

    return this.findById(taskId);
  }

  async addAuditEntry(data: {
    taskId: string;
    status: TaskStatus;
    details?: string;
  }): Promise<void> {
    // Use raw sql for the insert because taskAuditLog.status uses the task_status pg enum
    await this.db.execute(sql`
      INSERT INTO task_audit_log (id, task_id, status, details, created_at)
      VALUES (
        gen_random_uuid(),
        ${data.taskId},
        ${data.status}::task_status,
        ${data.details ?? null},
        NOW()
      )
    `);
  }
}
