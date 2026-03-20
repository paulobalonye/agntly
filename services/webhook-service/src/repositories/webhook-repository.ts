import { eq, sql, isNull, lte, and } from 'drizzle-orm';
import type { DbConnection } from '@agntly/shared';
import { webhookSubscriptions, webhookDeliveries } from '../db/schema.js';

export interface WebhookSubscriptionRow {
  readonly id: string;
  readonly userId: string;
  readonly url: string;
  readonly secretHash: string;
  readonly events: string[];
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface WebhookDeliveryRow {
  readonly id: string;
  readonly subscriptionId: string;
  readonly eventType: string;
  readonly eventId: string;
  readonly payload: string;
  readonly signature: string;
  readonly statusCode: number | null;
  readonly responseBody: string | null;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly nextRetryAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly failedAt: Date | null;
  readonly createdAt: Date;
}

export class WebhookRepository {
  constructor(private readonly db: DbConnection) {}

  // ─── Subscription methods ────────────────────────────────────────────────

  async createSubscription(data: {
    userId: string;
    url: string;
    secret: string;
    events: string[];
  }): Promise<WebhookSubscriptionRow> {
    const [row] = await this.db
      .insert(webhookSubscriptions)
      .values({
        userId: data.userId,
        url: data.url,
        secretHash: data.secret,
        events: data.events,
      })
      .returning();
    return row as WebhookSubscriptionRow;
  }

  async findSubscriptionById(id: string): Promise<WebhookSubscriptionRow | null> {
    const [row] = await this.db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.id, id))
      .limit(1);
    return (row as WebhookSubscriptionRow) ?? null;
  }

  async findSubscriptionsByUserId(userId: string): Promise<WebhookSubscriptionRow[]> {
    const rows = await this.db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.userId, userId));
    return rows as WebhookSubscriptionRow[];
  }

  async findActiveSubscriptionsByEvent(eventType: string): Promise<WebhookSubscriptionRow[]> {
    const rows = await this.db
      .select()
      .from(webhookSubscriptions)
      .where(
        and(
          eq(webhookSubscriptions.active, true),
          sql`${eventType} = ANY(${webhookSubscriptions.events})`,
        ),
      );
    return rows as WebhookSubscriptionRow[];
  }

  async deleteSubscription(id: string): Promise<void> {
    await this.db
      .delete(webhookSubscriptions)
      .where(eq(webhookSubscriptions.id, id));
  }

  // ─── Delivery methods ────────────────────────────────────────────────────

  async createDelivery(data: {
    subscriptionId: string;
    eventType: string;
    eventId: string;
    payload: string;
    signature: string;
  }): Promise<WebhookDeliveryRow> {
    const [row] = await this.db
      .insert(webhookDeliveries)
      .values({
        subscriptionId: data.subscriptionId,
        eventType: data.eventType,
        eventId: data.eventId,
        payload: data.payload,
        signature: data.signature,
      })
      .returning();
    return row as WebhookDeliveryRow;
  }

  async findDeliveryById(id: string): Promise<WebhookDeliveryRow | null> {
    const [row] = await this.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, id))
      .limit(1);
    return (row as WebhookDeliveryRow) ?? null;
  }

  async markDelivered(id: string, statusCode: number, responseBody: string): Promise<void> {
    await this.db.execute(sql`
      UPDATE webhook_deliveries
      SET
        status_code = ${statusCode},
        response_body = ${responseBody},
        delivered_at = NOW(),
        next_retry_at = NULL
      WHERE id = ${id}::uuid
    `);
  }

  async markRetry(
    id: string,
    statusCode: number | null,
    responseBody: string,
    nextRetryAt: Date,
  ): Promise<void> {
    await this.db.execute(sql`
      UPDATE webhook_deliveries
      SET
        attempts = attempts + 1,
        status_code = ${statusCode},
        response_body = ${responseBody},
        next_retry_at = ${nextRetryAt.toISOString()}::timestamptz
      WHERE id = ${id}::uuid
    `);
  }

  async markFailed(id: string, statusCode: number | null, responseBody: string): Promise<void> {
    await this.db.execute(sql`
      UPDATE webhook_deliveries
      SET
        status_code = ${statusCode},
        response_body = ${responseBody},
        failed_at = NOW(),
        next_retry_at = NULL,
        attempts = attempts + 1
      WHERE id = ${id}::uuid
    `);
  }

  async findPendingRetries(): Promise<WebhookDeliveryRow[]> {
    const rows = await this.db
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          isNull(webhookDeliveries.deliveredAt),
          isNull(webhookDeliveries.failedAt),
          lte(webhookDeliveries.nextRetryAt, sql`NOW()`),
        ),
      );
    return rows as WebhookDeliveryRow[];
  }
}
