import { pgTable, uuid, text, numeric, timestamp } from 'drizzle-orm/pg-core';

export const wallets = pgTable('wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull(),
  agentId: text('agent_id'),
  address: text('address').notNull().unique(),
  balance: numeric('balance', { precision: 18, scale: 6 }).notNull().default('0.000000'),
  locked: numeric('locked', { precision: 18, scale: 6 }).notNull().default('0.000000'),
  chain: text('chain').notNull().default('base-sepolia'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const deposits = pgTable('deposits', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id),
  amountUsd: numeric('amount_usd', { precision: 12, scale: 2 }).notNull(),
  usdcAmount: numeric('usdc_amount', { precision: 18, scale: 6 }).notNull(),
  method: text('method').notNull(), // card, ach, usdc
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  status: text('status').notNull().default('pending'), // pending, confirmed, failed
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const withdrawals = pgTable('withdrawals', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id),
  amount: numeric('amount', { precision: 18, scale: 6 }).notNull(),
  destination: text('destination').notNull(),
  fee: numeric('fee', { precision: 18, scale: 6 }).notNull().default('0.000000'),
  txHash: text('tx_hash'),
  status: text('status').notNull().default('queued'), // queued, processing, completed, failed
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
