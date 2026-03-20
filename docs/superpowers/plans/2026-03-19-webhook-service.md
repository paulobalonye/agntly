# Webhook Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stub webhook-service with a real event delivery system — subscribe to Redis Stream events, match to user webhook subscriptions, HMAC-sign payloads, deliver via HTTP, and retry with exponential backoff on failure.

**Architecture:** WebhookRepository handles subscription + delivery CRUD. WebhookDeliveryService handles HMAC signing, HTTP POST delivery, and retry scheduling. The server subscribes to ALL events on the Redis Stream and fans out to matching subscriptions. Deliveries are recorded in PostgreSQL with status tracking.

**Tech Stack:** Drizzle ORM, PostgreSQL, Redis Streams (EventBus), HMAC-SHA256, native fetch, Vitest

---

## File Structure

```
services/webhook-service/src/
├── repositories/
│   └── webhook-repository.ts     ← Subscription + delivery CRUD
├── services/
│   └── delivery-service.ts       ← HMAC signing, HTTP delivery, retry logic
├── routes/
│   └── webhooks.ts               ← Rewrite with real persistence
├── db/
│   └── schema.ts                 ← Already exists (good schema)
└── server.ts                     ← Wire DB, EventBus, repos, event consumer
```

---

## Task 1: Create WebhookRepository

**Files:**
- Create: `services/webhook-service/src/repositories/webhook-repository.ts`

Repository for both `webhook_subscriptions` and `webhook_deliveries` tables.

**Subscription methods:**
- `createSubscription(data)` — Insert with `.returning()`, hash the secret with SHA-256 before storing
- `findSubscriptionById(id)` — Drizzle select
- `findSubscriptionsByUserId(userId)` — List user's subscriptions
- `findActiveSubscriptionsByEvent(eventType)` — Find all active subscriptions that include this event type in their `events` array. Uses `sql` with `${eventType} = ANY(events)`.
- `deleteSubscription(id)` — Hard delete

**Delivery methods:**
- `createDelivery(data)` — Insert pending delivery record
- `findDeliveryById(id)` — Drizzle select
- `markDelivered(id, statusCode, responseBody)` — Set `deliveredAt`, `statusCode`, `responseBody`
- `markRetry(id, statusCode, responseBody, nextRetryAt)` — Increment `attempts`, set `nextRetryAt`, record last response
- `markFailed(id, statusCode, responseBody)` — Set `failedAt`, record last response
- `findPendingRetries()` — Select deliveries where `nextRetryAt <= NOW()` AND `deliveredAt IS NULL` AND `failedAt IS NULL`

Follow the same pattern as other repositories (Drizzle for reads, `db.execute(sql)` for atomic writes).

**After implementing:**
```bash
git add services/webhook-service/src/repositories/
git commit -m "feat: add WebhookRepository with subscription and delivery CRUD"
```

---

## Task 2: Create DeliveryService

**Files:**
- Create: `services/webhook-service/src/services/delivery-service.ts`

Handles the actual webhook delivery logic.

**Methods:**

**`signPayload(payload: string, secret: string): string`**
- HMAC-SHA256: `createHmac('sha256', secret).update(payload).digest('hex')`
- Returns the hex signature

**`deliver(subscription, event): Promise<void>`**
- Creates a delivery record in DB via repository
- Computes HMAC signature of the JSON payload using the subscription's secret
- POSTs to the subscription URL with headers:
  - `Content-Type: application/json`
  - `X-Agntly-Signature: sha256=${signature}`
  - `X-Agntly-Event: ${eventType}`
  - `X-Agntly-Delivery: ${deliveryId}`
- Timeout: 10 seconds (AbortController)
- On 2xx response: mark as delivered
- On non-2xx or network error: schedule retry with exponential backoff
- On max attempts reached (5): mark as failed

**`calculateNextRetry(attempts: number): Date`**
- Exponential backoff: `[60, 300, 1500, 7200, 43200]` seconds (1min, 5min, 25min, 2h, 12h)
- Returns `new Date(Date.now() + backoffSeconds[attempts] * 1000)`

**`processRetries(): Promise<void>`**
- Fetch all pending retries from DB
- For each: re-deliver (same logic as initial delivery)
- Called periodically (every 30 seconds) by the server

Constructor takes `WebhookRepository`. The subscription secret is stored as a hash in the DB, but the raw secret is needed for HMAC signing. Since the current stub stores secrets in plain text (the shared `WebhookSubscription` interface has `secret: string`), we'll store the raw secret (not hashed) for now — hashing is a future security improvement when we add proper secret management.

**After implementing:**
```bash
git add services/webhook-service/src/services/
git commit -m "feat: add DeliveryService with HMAC signing, HTTP delivery, and retry backoff"
```

---

## Task 3: Rewrite routes with real persistence

**Files:**
- Modify: `services/webhook-service/src/routes/webhooks.ts`

Replace the in-memory Map stub with real repository calls.

**Endpoints:**

**POST /** — Create webhook subscription
- Zod validate: `url` (URL), `secret` (min 16 chars), `events` (array of WebhookEvent)
- Store via `webhookRepo.createSubscription()`
- Return the subscription (without the secret)

**GET /** — List user's subscriptions
- `webhookRepo.findSubscriptionsByUserId(userId)` (userId from auth context, default 'demo-user')
- Return array

**DELETE /:webhookId** — Delete subscription
- `webhookRepo.deleteSubscription(webhookId)`
- Return `{ deleted: true }`

**POST /test** — Test webhook delivery
- Find the subscription, create a test event, deliver immediately
- Return delivery result (statusCode, delivered/failed)

Update the Zod events enum to include ALL current event types (the stub only has the original 7 — add the new saga events).

Access the repository via Fastify decorator: `(app as any).webhookRepo`.

**After implementing:**
```bash
git add services/webhook-service/src/routes/webhooks.ts
git commit -m "feat: rewrite webhook routes with real persistence"
```

---

## Task 4: Wire server with DB, EventBus, and event consumer

**Files:**
- Modify: `services/webhook-service/src/server.ts`

**Server setup:**
1. Import `createDbConnection`, `EventBus` from shared
2. Create DB, EventBus, WebhookRepository, DeliveryService
3. Decorate app with `webhookRepo` and `deliveryService`
4. Register routes

**Event consumer:**
Subscribe to ALL events on the Redis Stream. For each event:
1. Find active subscriptions matching the event type
2. For each matching subscription: call `deliveryService.deliver(subscription, event)`
3. Log delivery results

```typescript
await eventBus.subscribe(async (message) => {
  const subscriptions = await webhookRepo.findActiveSubscriptionsByEvent(message.type);
  for (const sub of subscriptions) {
    try {
      await deliveryService.deliver(sub, {
        id: message.id,
        type: message.type,
        data: message.data,
        timestamp: message.timestamp,
      });
    } catch (err) {
      app.log.error({ err, subscriptionId: sub.id, eventId: message.id }, 'Webhook delivery failed');
    }
  }
});
```

Note: subscribe with NO event filter (receive all events) — the filtering happens by matching subscription event types.

**Retry loop:**
Set up a 30-second interval that calls `deliveryService.processRetries()`:
```typescript
setInterval(() => deliveryService.processRetries().catch(err => app.log.error(err)), 30_000);
```

**After implementing:**
```bash
git add services/webhook-service/src/server.ts
git commit -m "feat: wire webhook-service with DB, EventBus, and event consumer"
```

---

## Task 5: Integration tests

**Files:**
- Create: `tests/integration/webhooks.test.ts`

Test the webhook repository and delivery service directly (no HTTP server needed).

**Test cases:**

1. **Create subscription + find by event type** — Create a subscription with events `['task.completed', 'wallet.funded']`, query by `task.completed` → finds it, query by `escrow.locked` → doesn't find it

2. **Delivery records created on deliver** — Create a subscription, deliver an event, verify a delivery record exists with correct eventId, signature, and status

3. **HMAC signature is correct** — Create a delivery, verify the signature matches `HMAC-SHA256(payload, secret)`

4. **Failed delivery schedules retry** — Mock fetch to return 500, deliver → delivery should have `nextRetryAt` set and `attempts = 1`

5. **Max attempts marks failed** — Set a delivery with `attempts = 4`, retry → should be marked failed with `failedAt` set

6. **Delete subscription** — Create, delete, find → null

Since the DeliveryService makes HTTP calls, mock `globalThis.fetch` in tests (same pattern as SDK tests).

**After implementing:**
```bash
git add tests/integration/webhooks.test.ts
git commit -m "test: add webhook delivery integration tests"
```

---

## Summary

| Task | What it does | Files |
|------|-------------|-------|
| 1 | WebhookRepository (subscriptions + deliveries) | `webhook-repository.ts` (new) |
| 2 | DeliveryService (HMAC, HTTP, retry) | `delivery-service.ts` (new) |
| 3 | Rewrite routes with persistence | `webhooks.ts` (rewrite) |
| 4 | Wire server + event consumer | `server.ts` (rewrite) |
| 5 | Integration tests | `webhooks.test.ts` (new) |

**Total: 5 tasks, ~6 files.**

**Key behaviors:**
- HMAC-SHA256 signed payloads with `X-Agntly-Signature` header
- Exponential backoff: 1min → 5min → 25min → 2h → 12h (5 attempts max)
- Subscribes to ALL Redis Stream events, fans out to matching subscriptions
- 30-second retry polling loop
- Delivery records track every attempt with status code and response body
