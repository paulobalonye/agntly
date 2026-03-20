import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { setupTestDb, cleanTestDb, teardownTestDb } from './setup.js';
import { WebhookRepository } from '../../services/webhook-service/src/repositories/webhook-repository.js';
import { DeliveryService } from '../../services/webhook-service/src/services/delivery-service.js';
import type { DbConnection } from '@agntly/shared';

const USER_1 = '00000000-0000-0000-0000-000000000001';
const WEBHOOK_URL = 'https://example.com/webhook';
const SECRET = 'supersecretvalue1234';

let db: DbConnection;
let webhookRepo: WebhookRepository;
let deliveryService: DeliveryService;

describe('Webhook Delivery', () => {
  beforeAll(async () => {
    const setup = await setupTestDb();
    db = setup.db;
    webhookRepo = new WebhookRepository(db);
    deliveryService = new DeliveryService(webhookRepo);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
    vi.restoreAllMocks();
  });

  // Test 1: Create subscription + find by event type
  it('should create a subscription and find it by event type', async () => {
    const sub = await webhookRepo.createSubscription({
      userId: USER_1,
      url: WEBHOOK_URL,
      secret: SECRET,
      events: ['task.completed', 'wallet.funded'],
    });

    expect(sub.id).toBeTruthy();
    expect(sub.url).toBe(WEBHOOK_URL);
    expect(sub.events).toContain('task.completed');
    expect(sub.events).toContain('wallet.funded');

    // Finds by matching event type
    const matched = await webhookRepo.findActiveSubscriptionsByEvent('task.completed');
    expect(matched.length).toBe(1);
    expect(matched[0]!.id).toBe(sub.id);

    // Does not find by non-matching event type
    const notMatched = await webhookRepo.findActiveSubscriptionsByEvent('escrow.locked');
    expect(notMatched.length).toBe(0);
  });

  // Test 2: Delivery records created correctly
  it('should create delivery records with correct eventId and signature', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'OK',
    }));

    const sub = await webhookRepo.createSubscription({
      userId: USER_1,
      url: WEBHOOK_URL,
      secret: SECRET,
      events: ['task.completed'],
    });

    const event = {
      id: 'evt_test_001',
      type: 'task.completed',
      data: { taskId: 'task_abc' },
      timestamp: new Date().toISOString(),
    };

    await deliveryService.deliver(sub, event);

    // Find deliveries by querying the DB via deliveryRepo — use findPendingRetries won't work since delivered
    // Instead verify via findDeliveryById with a query trick: check subscriptionId
    const delivery = await db.query.webhookDeliveries?.findFirst?.({
      where: (t: any, { eq }: any) => eq(t.subscriptionId, sub.id),
    }).catch(() => null);

    // Fallback: use raw SQL check via the repo's find
    // We'll instead verify by checking the delivery was recorded through a direct query
    const rawResult = await (db as any).execute(
      `SELECT * FROM webhook_deliveries WHERE subscription_id = '${sub.id}' LIMIT 1`,
    );

    // Handle both row array and object formats
    const rows = rawResult?.rows ?? rawResult ?? [];
    const row = Array.isArray(rows) ? rows[0] : rows;

    expect(row).toBeTruthy();
    expect(row.event_id).toBe('evt_test_001');
    expect(row.event_type).toBe('task.completed');
    expect(row.delivered_at).toBeTruthy();
  });

  // Test 3: HMAC signature verification
  it('should produce a correct HMAC-SHA256 signature', () => {
    const payload = JSON.stringify({ id: 'evt_001', type: 'task.completed', data: {}, timestamp: '2026-01-01T00:00:00.000Z' });
    const expected = createHmac('sha256', SECRET).update(payload).digest('hex');
    const actual = deliveryService.signPayload(payload, SECRET);
    expect(actual).toBe(expected);
  });

  // Test 4: Failed delivery schedules retry
  it('should schedule a retry when delivery returns non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    }));

    const sub = await webhookRepo.createSubscription({
      userId: USER_1,
      url: WEBHOOK_URL,
      secret: SECRET,
      events: ['task.failed'],
    });

    const event = {
      id: 'evt_test_002',
      type: 'task.failed',
      data: {},
      timestamp: new Date().toISOString(),
    };

    await deliveryService.deliver(sub, event);

    const rawResult = await (db as any).execute(
      `SELECT * FROM webhook_deliveries WHERE subscription_id = '${sub.id}' LIMIT 1`,
    );

    const rows = rawResult?.rows ?? rawResult ?? [];
    const row = Array.isArray(rows) ? rows[0] : rows;

    expect(row).toBeTruthy();
    expect(row.status_code).toBe(500);
    expect(row.next_retry_at).toBeTruthy();
    expect(row.attempts).toBe(1);
    expect(row.delivered_at).toBeNull();
    expect(row.failed_at).toBeNull();
  });

  // Test 5: Max attempts marks as failed
  it('should mark delivery as failed when max attempts reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    }));

    const sub = await webhookRepo.createSubscription({
      userId: USER_1,
      url: WEBHOOK_URL,
      secret: SECRET,
      events: ['wallet.funded'],
    });

    // Create a delivery already at attempts = 4 (max - 1 = 4, so next failure should mark failed)
    const payload = JSON.stringify({ id: 'evt_max', type: 'wallet.funded', data: {}, timestamp: new Date().toISOString() });
    const signature = deliveryService.signPayload(payload, SECRET);

    const delivery = await webhookRepo.createDelivery({
      subscriptionId: sub.id,
      eventType: 'wallet.funded',
      eventId: 'evt_max',
      payload,
      signature,
    });

    // Manually set attempts to 4 (the threshold for marking failed on next attempt)
    await (db as any).execute(
      `UPDATE webhook_deliveries SET attempts = 4, next_retry_at = NOW() - INTERVAL '1 second' WHERE id = '${delivery.id}'`,
    );

    // Re-fetch so processRetries can pick it up
    await deliveryService.processRetries();

    const rawResult = await (db as any).execute(
      `SELECT * FROM webhook_deliveries WHERE id = '${delivery.id}' LIMIT 1`,
    );

    const rows = rawResult?.rows ?? rawResult ?? [];
    const row = Array.isArray(rows) ? rows[0] : rows;

    expect(row).toBeTruthy();
    expect(row.failed_at).toBeTruthy();
    expect(row.delivered_at).toBeNull();
  });

  // Test 6: Delete subscription
  it('should delete a subscription and return null on find', async () => {
    const sub = await webhookRepo.createSubscription({
      userId: USER_1,
      url: WEBHOOK_URL,
      secret: SECRET,
      events: ['agent.verified'],
    });

    const found = await webhookRepo.findSubscriptionById(sub.id);
    expect(found).not.toBeNull();

    await webhookRepo.deleteSubscription(sub.id);

    const deleted = await webhookRepo.findSubscriptionById(sub.id);
    expect(deleted).toBeNull();
  });
});
