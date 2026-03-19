import { pgTable, uuid, text, numeric, timestamp } from 'drizzle-orm/pg-core';

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  walletId: uuid('wallet_id').notNull(),
  amountUsd: numeric('amount_usd', { precision: 12, scale: 2 }).notNull(),
  usdcAmount: numeric('usdc_amount', { precision: 18, scale: 6 }),
  method: text('method').notNull(), // card, ach, usdc_direct
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeSessionId: text('stripe_session_id').unique(),
  circlePaymentId: text('circle_payment_id'),
  status: text('status').notNull().default('pending'), // pending, processing, completed, failed, refunded
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  plan: text('plan').notNull(), // free, pro, enterprise
  stripeSubscriptionId: text('stripe_subscription_id'),
  status: text('status').notNull().default('active'), // active, canceled, past_due
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description').notNull(),
  stripeInvoiceId: text('stripe_invoice_id'),
  status: text('status').notNull().default('draft'), // draft, sent, paid, void
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
