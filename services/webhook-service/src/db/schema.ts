import { pgTable, uuid, text, boolean, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const webhookEventEnum = pgEnum('webhook_event', [
  'task.escrowed', 'task.completed', 'task.failed', 'task.disputed',
  'wallet.funded', 'wallet.withdrawn', 'agent.verified',
]);

export const webhookSubscriptions = pgTable('webhook_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  url: text('url').notNull(),
  secretHash: text('secret_hash').notNull(),
  events: text('events').array().notNull(), // array of webhook event types
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id').notNull().references(() => webhookSubscriptions.id),
  eventType: text('event_type').notNull(),
  eventId: text('event_id').notNull(),
  payload: text('payload').notNull(), // JSON string
  signature: text('signature').notNull(), // HMAC-SHA256
  statusCode: integer('status_code'),
  responseBody: text('response_body'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(5),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
