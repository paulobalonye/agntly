import { pgTable, uuid, text, numeric, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const escrowStateEnum = pgEnum('escrow_state', ['locked', 'released', 'refunded', 'disputed']);

export const escrows = pgTable('escrows', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: text('task_id').notNull().unique(),
  fromWalletId: uuid('from_wallet_id').notNull(),
  toWalletId: uuid('to_wallet_id').notNull(),
  amount: numeric('amount', { precision: 18, scale: 6 }).notNull(),
  fee: numeric('fee', { precision: 18, scale: 6 }).notNull(),
  state: escrowStateEnum('state').notNull().default('locked'),
  txHash: text('tx_hash'),
  resultHash: text('result_hash'),
  disputeReason: text('dispute_reason'),
  disputeEvidence: text('dispute_evidence'),
  deadline: timestamp('deadline', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  settledAt: timestamp('settled_at', { withTimezone: true }),
});

export const escrowAuditLog = pgTable('escrow_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  escrowId: uuid('escrow_id').notNull().references(() => escrows.id),
  action: text('action').notNull(), // locked, released, refunded, disputed, resolved
  actor: text('actor').notNull(),
  details: text('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
