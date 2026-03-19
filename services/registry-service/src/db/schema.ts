import { pgTable, uuid, text, numeric, integer, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const agentStatusEnum = pgEnum('agent_status', ['active', 'paused', 'delisted']);

export const agents = pgTable('agents', {
  id: text('id').primaryKey(), // user-defined agent_id
  ownerId: uuid('owner_id').notNull(),
  walletId: uuid('wallet_id').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  endpoint: text('endpoint').notNull(),
  priceUsdc: numeric('price_usdc', { precision: 10, scale: 6 }).notNull(),
  category: text('category').notNull(),
  tags: text('tags').array().notNull().default([]),
  status: agentStatusEnum('status').notNull().default('active'),
  verified: boolean('verified').notNull().default(false),
  reputation: numeric('reputation', { precision: 3, scale: 2 }).notNull().default('0.00'),
  callsTotal: integer('calls_total').notNull().default(0),
  callsLast24h: integer('calls_last_24h').notNull().default(0),
  uptimePct: numeric('uptime_pct', { precision: 5, scale: 2 }).notNull().default('100.00'),
  avgLatencyMs: integer('avg_latency_ms').notNull().default(0),
  totalEarned: numeric('total_earned', { precision: 18, scale: 6 }).notNull().default('0.000000'),
  timeoutMs: integer('timeout_ms').notNull().default(30000),
  featuredUntil: timestamp('featured_until', { withTimezone: true }),
  registryTxHash: text('registry_tx_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const agentReviews = pgTable('agent_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: text('agent_id').notNull().references(() => agents.id),
  reviewerId: uuid('reviewer_id').notNull(),
  rating: integer('rating').notNull(), // 1-5
  comment: text('comment'),
  taskId: text('task_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
