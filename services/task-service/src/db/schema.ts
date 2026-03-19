import { pgTable, uuid, text, numeric, integer, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';

export const taskStatusEnum = pgEnum('task_status', ['pending', 'escrowed', 'dispatched', 'complete', 'failed', 'disputed']);

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(), // tsk_xxxx format
  orchestratorId: uuid('orchestrator_id').notNull(),
  agentId: text('agent_id').notNull(),
  payload: jsonb('payload').notNull(),
  result: jsonb('result'),
  status: taskStatusEnum('status').notNull().default('pending'),
  amount: numeric('amount', { precision: 18, scale: 6 }).notNull(),
  fee: numeric('fee', { precision: 18, scale: 6 }).notNull(),
  escrowTx: text('escrow_tx'),
  settleTx: text('settle_tx'),
  deadline: timestamp('deadline', { withTimezone: true }).notNull(),
  latencyMs: integer('latency_ms'),
  errorMessage: text('error_message'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const taskAuditLog = pgTable('task_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: text('task_id').notNull().references(() => tasks.id),
  status: taskStatusEnum('status').notNull(),
  details: text('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
