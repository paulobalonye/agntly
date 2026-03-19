# Phase 4: Money In — Stripe Checkout → Wallet Funding

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users fund their Agntly wallets via Stripe Checkout (card + ACH), with idempotent webhook processing and atomic wallet crediting inside a single DB transaction.

**Architecture:** StripeClient wraps the Stripe SDK (injectable for testing). PaymentRepository handles atomic CAS writes. PaymentService orchestrates checkout creation and webhook processing. The webhook handler runs `markCompleted` + `creditBalance` inside a single PostgreSQL transaction to prevent double-credits. The webhook route uses a raw body parser for Stripe signature verification.

**Tech Stack:** Stripe SDK (`stripe` npm), Drizzle ORM, PostgreSQL, Redis Streams EventBus, Zod, Vitest

---

## File Structure

### New files
- `services/payment-service/src/services/stripe-client.ts` — Stripe SDK wrapper (injectable interface)
- `services/payment-service/src/repositories/payment-repository.ts` — Payment CRUD + atomic CAS
- `services/payment-service/src/services/payment-service.ts` — Business logic
- `services/payment-service/src/routes/webhook.ts` — Webhook route with raw body parser (separate plugin)
- `tests/integration/payments.test.ts` — 8 integration test cases

### Modified files
- `services/payment-service/src/db/schema.ts` — Add `.unique()` to `stripeSessionId`
- `services/payment-service/src/routes/payments.ts` — Replace stubs with real checkout + history handlers
- `services/payment-service/src/server.ts` — Wire DB, EventBus, Stripe, repos, services
- `services/payment-service/package.json` — Add `stripe` dependency

---

## Task 1: Add `stripe` dependency and fix DB schema

**Files:**
- Modify: `services/payment-service/package.json`
- Modify: `services/payment-service/src/db/schema.ts`

- [ ] **Step 1: Add stripe and wallet-service dependencies**

Add to `dependencies` in `services/payment-service/package.json`:
```json
"stripe": "^17.0.0",
"@agntly/wallet-service": "workspace:*"
```

The `wallet-service` workspace dependency is needed because `PaymentService` imports `WalletRepository` for wallet ownership checks.

- [ ] **Step 2: Install**

Run: `cd /Users/drpraize/agntly && pnpm install`

- [ ] **Step 3: Add unique constraint to stripe_session_id**

In `services/payment-service/src/db/schema.ts`, change line 11 from:
```typescript
  stripeSessionId: text('stripe_session_id'),
```
to:
```typescript
  stripeSessionId: text('stripe_session_id').unique(),
```

- [ ] **Step 4: Add unique index to migrate.sql**

Add after the existing `idx_payments_status` index in `scripts/migrate.sql`:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_stripe_session ON payments(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
```

- [ ] **Step 5: Verify build**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/payment-service build`

- [ ] **Step 6: Commit**

```bash
git add services/payment-service/package.json services/payment-service/src/db/schema.ts scripts/migrate.sql pnpm-lock.yaml
git commit -m "feat: add stripe dependency and unique constraint on stripe_session_id"
```

---

## Task 2: Create StripeClient (injectable wrapper)

**Files:**
- Create: `services/payment-service/src/services/stripe-client.ts`

- [ ] **Step 1: Write the StripeClient**

Create `services/payment-service/src/services/stripe-client.ts`:

```typescript
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const SUCCESS_URL = process.env.STRIPE_SUCCESS_URL ?? 'http://localhost:3000/wallet?funded=true';
const CANCEL_URL = process.env.STRIPE_CANCEL_URL ?? 'http://localhost:3000/wallet?canceled=true';

export interface CheckoutSessionParams {
  readonly amountCents: number;
  readonly method: 'card' | 'ach';
  readonly metadata: {
    readonly walletId: string;
    readonly userId: string;
    readonly paymentId: string;
  };
}

export interface CheckoutSessionResult {
  readonly sessionId: string;
  readonly url: string;
  readonly expiresAt: number;
}

export interface StripeWebhookEvent {
  readonly type: string;
  readonly data: {
    readonly object: {
      readonly id: string;
      readonly amount_total: number;
      readonly metadata: Record<string, string>;
      readonly payment_status: string;
    };
  };
}

/**
 * Interface for Stripe operations — injectable for testing.
 */
export interface IStripeClient {
  createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult>;
  verifyWebhookSignature(signature: string, rawBody: Buffer): StripeWebhookEvent;
}

export class StripeClient implements IStripeClient {
  private readonly stripe: Stripe;

  constructor(secretKey?: string) {
    this.stripe = new Stripe(secretKey ?? STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });
  }

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      params.method === 'ach' ? ['us_bank_account'] : ['card'];

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: paymentMethodTypes,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: params.amountCents,
            product_data: {
              name: 'Agntly Wallet Funding',
              description: `Fund wallet with $${(params.amountCents / 100).toFixed(2)} USD`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        walletId: params.metadata.walletId,
        userId: params.metadata.userId,
        paymentId: params.metadata.paymentId,
      },
      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL,
    });

    return {
      sessionId: session.id,
      url: session.url ?? '',
      expiresAt: session.expires_at,
    };
  }

  verifyWebhookSignature(signature: string, rawBody: Buffer): StripeWebhookEvent {
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET,
    );
    return event as unknown as StripeWebhookEvent;
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/payment-service build`

- [ ] **Step 3: Commit**

```bash
git add services/payment-service/src/services/stripe-client.ts
git commit -m "feat: add injectable StripeClient wrapper for Checkout Sessions"
```

---

## Task 3: Create PaymentRepository with atomic CAS

**Files:**
- Create: `services/payment-service/src/repositories/payment-repository.ts`

- [ ] **Step 1: Write the PaymentRepository**

Create `services/payment-service/src/repositories/payment-repository.ts`:

```typescript
import { eq, sql, desc } from 'drizzle-orm';
import type { DbConnection } from '@agntly/shared';
import { payments } from '../db/schema.js';

export interface PaymentRow {
  readonly id: string;
  readonly userId: string;
  readonly walletId: string;
  readonly amountUsd: string;
  readonly usdcAmount: string | null;
  readonly method: string;
  readonly stripeSessionId: string | null;
  readonly status: string;
  readonly failureReason: string | null;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
}

export class PaymentRepository {
  constructor(private readonly db: DbConnection) {}

  async create(data: {
    userId: string;
    walletId: string;
    amountUsd: string;
    method: string;
    stripeSessionId: string;
  }): Promise<PaymentRow> {
    const [row] = await this.db
      .insert(payments)
      .values({
        userId: data.userId,
        walletId: data.walletId,
        amountUsd: data.amountUsd,
        method: data.method,
        stripeSessionId: data.stripeSessionId,
        status: 'pending',
      })
      .returning();
    return row as unknown as PaymentRow;
  }

  async findById(id: string): Promise<PaymentRow | null> {
    const [row] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.id, id))
      .limit(1);
    return (row as unknown as PaymentRow) ?? null;
  }

  async findByStripeSessionId(sessionId: string): Promise<PaymentRow | null> {
    const [row] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.stripeSessionId, sessionId))
      .limit(1);
    return (row as unknown as PaymentRow) ?? null;
  }

  async findByUserId(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ rows: readonly PaymentRow[]; total: number }> {
    const rows = await this.db
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(payments)
      .where(eq(payments.userId, userId));

    return {
      rows: rows as unknown as PaymentRow[],
      total: countResult?.count ?? 0,
    };
  }

  /**
   * Atomic CAS: mark payment as completed ONLY if currently pending.
   * Returns the payment ID if transition succeeded, null if already completed.
   * This is the idempotency guard for webhook processing.
   */
  async markCompleted(stripeSessionId: string, usdcAmount: string): Promise<string | null> {
    const result = await this.db.execute(sql`
      UPDATE payments
      SET
        status = 'completed',
        usdc_amount = ${usdcAmount}::numeric,
        completed_at = NOW()
      WHERE stripe_session_id = ${stripeSessionId}
        AND status = 'pending'
      RETURNING id
    `);
    const row = result.rows?.[0] as { id: string } | undefined;
    return row?.id ?? null;
  }

  /**
   * Atomic: mark payment as failed ONLY if currently pending.
   */
  async markFailed(id: string, reason: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE payments
      SET
        status = 'failed',
        failure_reason = ${reason}
      WHERE id = ${id}::uuid
        AND status = 'pending'
      RETURNING id
    `);
    return (result.rows?.length ?? 0) > 0;
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/payment-service build`

- [ ] **Step 3: Commit**

```bash
git add services/payment-service/src/repositories/payment-repository.ts
git commit -m "feat: add PaymentRepository with atomic CAS idempotency guard"
```

---

## Task 4: Create PaymentService with transactional webhook handling

**Files:**
- Create: `services/payment-service/src/services/payment-service.ts`

- [ ] **Step 1: Write the PaymentService**

Create `services/payment-service/src/services/payment-service.ts`:

```typescript
import { generateId } from '@agntly/shared';
import type { EventBus } from '@agntly/shared';
import type { PaymentRepository } from '../repositories/payment-repository.js';
import type { IStripeClient, StripeWebhookEvent } from './stripe-client.js';
import type { WalletRepository } from '../../wallet-service/src/repositories/wallet-repository.js';
import pg from 'pg';

export class PaymentService {
  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly walletRepo: WalletRepository,
    private readonly stripeClient: IStripeClient,
    private readonly pool: pg.Pool,
    private readonly eventBus?: EventBus,
  ) {}

  async createCheckout(
    userId: string,
    walletId: string,
    amountUsd: number,
    method: 'card' | 'ach',
  ): Promise<{
    paymentId: string;
    checkoutUrl: string;
    amountUsd: number;
    method: string;
    expiresAt: string;
  }> {
    // Verify wallet exists and belongs to user
    const wallet = await this.walletRepo.findById(walletId);
    if (!wallet) throw new Error('Wallet not found');
    if (wallet.ownerId !== userId) throw new Error('Wallet does not belong to user');

    const paymentId = generateId('pay');
    const amountCents = Math.round(amountUsd * 100);

    // Create Stripe Checkout Session
    const session = await this.stripeClient.createCheckoutSession({
      amountCents,
      method,
      metadata: { walletId, userId, paymentId },
    });

    // Record pending payment
    await this.paymentRepo.create({
      userId,
      walletId,
      amountUsd: amountUsd.toFixed(2),
      method,
      stripeSessionId: session.sessionId,
    });

    return {
      paymentId,
      checkoutUrl: session.url,
      amountUsd,
      method,
      expiresAt: new Date(session.expiresAt * 1000).toISOString(),
    };
  }

  async handleWebhook(signature: string, rawBody: Buffer): Promise<void> {
    // Verify Stripe signature (throws on invalid)
    const event = this.stripeClient.verifyWebhookSignature(signature, rawBody);

    // Only handle checkout.session.completed
    if (event.type !== 'checkout.session.completed') return;

    const session = event.data.object;
    const stripeSessionId = session.id;
    const walletId = session.metadata.walletId;
    const usdcAmount = (session.amount_total / 100).toFixed(6);

    // Atomic transaction: markCompleted + creditBalance
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Atomic CAS: only first processor wins
      const result = await client.query(
        `UPDATE payments
         SET status = 'completed', usdc_amount = $2::numeric, completed_at = NOW()
         WHERE stripe_session_id = $1 AND status = 'pending'
         RETURNING id, wallet_id`,
        [stripeSessionId, usdcAmount],
      );

      if (result.rows.length === 0) {
        // Already completed (duplicate webhook) or not found
        await client.query('ROLLBACK');
        return;
      }

      // Credit the wallet within the same transaction
      const creditResult = await client.query(
        `UPDATE wallets
         SET balance = balance + $2::numeric, updated_at = NOW()
         WHERE id = $1::uuid
         RETURNING id`,
        [walletId, usdcAmount],
      );

      if (creditResult.rows.length === 0) {
        // Wallet not found — rollback the payment completion
        await client.query('ROLLBACK');
        // Mark payment as failed outside the transaction
        await this.paymentRepo.markFailed(result.rows[0].id, 'wallet_not_found');
        return;
      }

      await client.query('COMMIT');

      // Publish event (outside transaction — best effort)
      if (this.eventBus) {
        await this.eventBus.publish('wallet.funded', {
          paymentId: result.rows[0].id,
          walletId,
          userId: session.metadata.userId,
          usdcAmount,
          method: session.metadata.method ?? 'card',
          stripeSessionId,
        });
      }
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getPaymentHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{
    payments: readonly any[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const { rows, total } = await this.paymentRepo.findByUserId(userId, limit, offset);
    return { payments: rows, total, limit, offset };
  }
}
```

Key design decisions:
- `handleWebhook` uses a raw `pg.Pool` client for the transaction (not Drizzle) because we need `BEGIN/COMMIT/ROLLBACK` control over two tables (payments + wallets) on the SAME connection. Drizzle's `db` connection is a separate pool — we cannot mix Drizzle and raw pg in one transaction. Both UPDATEs (markCompleted + creditBalance) are inline raw SQL on the same `client` — this is intentional and correct.
- `WalletRepository.creditBalance` is NOT called — the inline SQL is equivalent but runs on the transactional client. The `WalletRepository` is only used for `findById` (wallet ownership check in `createCheckout`).
- The CAS UPDATE on payments IS the idempotency guard — no separate read needed.
- If the wallet doesn't exist, we rollback the payment completion and mark it failed separately (via `paymentRepo.markFailed` which uses the Drizzle pool — fine since it's outside the transaction).
- EventBus publish is outside the transaction (best-effort, non-critical).

- [ ] **Step 2: Verify build**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/payment-service build`

- [ ] **Step 3: Commit**

```bash
git add services/payment-service/src/services/payment-service.ts
git commit -m "feat: add PaymentService with transactional webhook handling"
```

---

## Task 5: Create webhook route with raw body parser

The webhook endpoint needs its own Fastify plugin so the raw body parser is scoped only to `/webhook` and doesn't affect other routes.

**Files:**
- Create: `services/payment-service/src/routes/webhook.ts`

- [ ] **Step 1: Write the webhook route plugin**

Create `services/payment-service/src/routes/webhook.ts`:

```typescript
import type { FastifyPluginAsync } from 'fastify';
import type { PaymentService } from '../services/payment-service.js';

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  // CRITICAL: Register raw body parser so Stripe signature verification works.
  // This parser is scoped to this plugin only (not the parent app).
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body),
  );

  app.post('/webhook', async (request, reply) => {
    const paymentService = (app as any).paymentService as PaymentService;
    const signature = request.headers['stripe-signature'] as string | undefined;

    if (!signature) {
      return reply.status(400).send({ error: 'Missing stripe-signature header' });
    }

    try {
      await paymentService.handleWebhook(signature, request.body as Buffer);
      return reply.status(200).send({ received: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook processing failed';
      // Stripe signature errors should return 400
      if (message.includes('signature') || message.includes('Webhook')) {
        return reply.status(400).send({ error: 'Invalid webhook signature' });
      }
      // Other errors return 500 so Stripe retries
      request.log.error({ err }, 'Webhook processing error');
      return reply.status(500).send({ error: 'Internal error' });
    }
  });
};
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/payment-service build`

- [ ] **Step 3: Commit**

```bash
git add services/payment-service/src/routes/webhook.ts
git commit -m "feat: add webhook route with scoped raw body parser for Stripe signatures"
```

---

## Task 6: Replace stub payment routes with real handlers

**Files:**
- Modify: `services/payment-service/src/routes/payments.ts`

- [ ] **Step 1: Rewrite payments.ts**

Replace `services/payment-service/src/routes/payments.ts` entirely:

```typescript
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import type { PaymentService } from '../services/payment-service.js';

const checkoutSchema = z.object({
  walletId: z.string().uuid(),
  amountUsd: z.number().positive().min(1).max(10000),
  method: z.enum(['card', 'ach']),
});

const historySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const paymentRoutes: FastifyPluginAsync = async (app) => {
  const paymentService = (app as any).paymentService as PaymentService;

  // POST /checkout — Create Stripe Checkout Session
  app.post('/checkout', async (request, reply) => {
    const parsed = checkoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(createErrorResponse('Invalid request: walletId (uuid), amountUsd (1-10000), method (card|ach) required'));
    }

    // userId from auth context (fallback to demo-user for dev)
    const userId = (request as any).userId ?? 'demo-user';

    try {
      const result = await paymentService.createCheckout(
        userId,
        parsed.data.walletId,
        parsed.data.amountUsd,
        parsed.data.method,
      );
      return reply.status(201).send(createApiResponse(result));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Checkout creation failed';
      const status = message.includes('does not belong') ? 403 : 400;
      return reply.status(status).send(createErrorResponse(message));
    }
  });

  // GET /history — Paginated payment history
  app.get('/history', async (request, reply) => {
    const parsed = historySchema.safeParse(request.query);
    const { limit, offset } = parsed.success ? parsed.data : { limit: 20, offset: 0 };
    const userId = (request as any).userId ?? 'demo-user';

    const result = await paymentService.getPaymentHistory(userId, limit, offset);
    // createApiResponse only accepts one arg — inline the meta field
    return reply.status(200).send({
      success: true,
      data: result.payments,
      error: null,
      meta: { total: result.total, limit: result.limit, offset: result.offset },
    });
  });
};
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/payment-service build`

- [ ] **Step 3: Commit**

```bash
git add services/payment-service/src/routes/payments.ts
git commit -m "feat: replace stub payment routes with real checkout and history handlers"
```

---

## Task 7: Wire everything into server.ts

**Files:**
- Modify: `services/payment-service/src/server.ts`

- [ ] **Step 1: Rewrite server.ts**

Replace `services/payment-service/src/server.ts` entirely:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { SERVICE_PORTS, createDbConnection, createPool, EventBus } from '@agntly/shared';
import { healthRoutes } from './routes/health.js';
import { paymentRoutes } from './routes/payments.js';
import { webhookRoutes } from './routes/webhook.js';
import { PaymentRepository } from './repositories/payment-repository.js';
import { PaymentService } from './services/payment-service.js';
import { StripeClient } from './services/stripe-client.js';
import { WalletRepository } from '../../wallet-service/src/repositories/wallet-repository.js';

const db = createDbConnection();
const pool = createPool();
const eventBus = new EventBus('payment-service');
const stripeClient = new StripeClient();

const paymentRepo = new PaymentRepository(db);
const walletRepo = new WalletRepository(db);
const paymentService = new PaymentService(paymentRepo, walletRepo, stripeClient, pool, eventBus);

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

app.decorate('paymentService', paymentService);

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(paymentRoutes, { prefix: '/v1/payments' });
// Webhook registered under /v1/payments but in its own plugin for raw body parser scoping
await app.register(webhookRoutes, { prefix: '/v1/payments' });

const port = SERVICE_PORTS.payment;
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`payment-service running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
```

- [ ] **Step 2: Verify full build**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/shared build && pnpm --filter @agntly/payment-service build`

- [ ] **Step 3: Commit**

```bash
git add services/payment-service/src/server.ts
git commit -m "feat: wire DB, EventBus, Stripe, and repos into payment-service"
```

---

## Task 8: Write integration tests with mocked Stripe

**Files:**
- Create: `tests/integration/payments.test.ts`

- [ ] **Step 1: Write the payment integration tests**

Create `tests/integration/payments.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, cleanTestDb, teardownTestDb } from './setup.js';
import { PaymentRepository } from '../../services/payment-service/src/repositories/payment-repository.js';
import { PaymentService } from '../../services/payment-service/src/services/payment-service.js';
import { WalletRepository } from '../../services/wallet-service/src/repositories/wallet-repository.js';
import { WalletService } from '../../services/wallet-service/src/services/wallet-service.js';
import type { IStripeClient, CheckoutSessionParams, CheckoutSessionResult, StripeWebhookEvent } from '../../services/payment-service/src/services/stripe-client.js';
import type { DbConnection } from '@agntly/shared';
import pg from 'pg';

// Mock Stripe client — no real API calls
class MockStripeClient implements IStripeClient {
  lastSessionParams: CheckoutSessionParams | null = null;
  shouldFailSignature = false;

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    this.lastSessionParams = params;
    return {
      sessionId: `cs_test_${Date.now()}`,
      url: 'https://checkout.stripe.com/test',
      expiresAt: Math.floor(Date.now() / 1000) + 1800,
    };
  }

  verifyWebhookSignature(signature: string, rawBody: Buffer): StripeWebhookEvent {
    if (this.shouldFailSignature) {
      throw new Error('Invalid webhook signature');
    }
    const body = JSON.parse(rawBody.toString());
    return body as StripeWebhookEvent;
  }
}

// Use valid UUIDs — the DB schema has uuid columns for userId/walletId
const USER_1 = '00000000-0000-0000-0000-000000000001';
const USER_2 = '00000000-0000-0000-0000-000000000002';
const USER_3 = '00000000-0000-0000-0000-000000000003';
const USER_4 = '00000000-0000-0000-0000-000000000004';
const USER_5 = '00000000-0000-0000-0000-000000000005';
const USER_6 = '00000000-0000-0000-0000-000000000006';
const USER_DIFFERENT = '00000000-0000-0000-0000-000000000099';

let db: DbConnection;
let pool: pg.Pool;
let paymentRepo: PaymentRepository;
let walletRepo: WalletRepository;
let walletService: WalletService;

describe('Phase 4: Money In — Stripe Checkout → Wallet Funding', () => {
  beforeAll(async () => {
    const setup = await setupTestDb();
    db = setup.db;
    pool = setup.pool;
    paymentRepo = new PaymentRepository(db);
    walletRepo = new WalletRepository(db);
    walletService = new WalletService(walletRepo);
  });

  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await cleanTestDb(); });

  function createPaymentService(mockStripe?: MockStripeClient) {
    const stripe = mockStripe ?? new MockStripeClient();
    return { service: new PaymentService(paymentRepo, walletRepo, stripe, pool), stripe };
  }

  function buildWebhookEvent(sessionId: string, amountCents: number, metadata: Record<string, string>): Buffer {
    return Buffer.from(JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sessionId,
          amount_total: amountCents,
          metadata,
          payment_status: 'paid',
        },
      },
    }));
  }

  // Test 1: Create checkout returns URL and pending payment
  it('should create checkout session and record pending payment', async () => {
    const wallet = await walletService.createWallet(USER_1);
    const { service, stripe } = createPaymentService();

    const result = await service.createCheckout(USER_1, wallet.id, 10, 'card');

    expect(result.checkoutUrl).toBe('https://checkout.stripe.com/test');
    expect(result.amountUsd).toBe(10);
    expect(result.method).toBe('card');
    expect(stripe.lastSessionParams?.amountCents).toBe(1000);
    expect(stripe.lastSessionParams?.metadata.walletId).toBe(wallet.id);
  });

  // Test 2: Checkout for wallet not owned by user
  it('should reject checkout for wallet not owned by user', async () => {
    const wallet = await walletService.createWallet(USER_1);
    const { service } = createPaymentService();

    await expect(
      service.createCheckout(USER_DIFFERENT, wallet.id, 10, 'card'),
    ).rejects.toThrow('does not belong');
  });

  // Test 3: Webhook credits wallet correctly
  it('should credit wallet on valid webhook', async () => {
    const wallet = await walletService.createWallet(USER_2);
    const { service } = createPaymentService();

    // Create checkout first (records pending payment with stripe_session_id)
    const checkout = await service.createCheckout(USER_2, wallet.id, 25, 'card');

    // Find the payment to get the stripe session ID
    const payment = await paymentRepo.findByUserId(USER_2, 1, 0);
    const stripeSessionId = payment.rows[0]?.stripeSessionId;
    expect(stripeSessionId).toBeTruthy();

    // Simulate webhook
    const webhookBody = buildWebhookEvent(stripeSessionId!, 2500, {
      walletId: wallet.id,
      userId: USER_2,
      paymentId: checkout.paymentId,
    });

    await service.handleWebhook('valid-sig', webhookBody);

    // Verify wallet was credited
    const funded = await walletRepo.findById(wallet.id);
    expect(parseFloat(funded!.balance)).toBe(25);

    // Verify payment is marked completed
    const completedPayment = await paymentRepo.findByStripeSessionId(stripeSessionId!);
    expect(completedPayment!.status).toBe('completed');
    expect(completedPayment!.usdcAmount).toBeTruthy();
  });

  // Test 4: Duplicate webhook — no double credit
  it('should not double-credit on duplicate webhook', async () => {
    const wallet = await walletService.createWallet(USER_3);
    const { service } = createPaymentService();

    await service.createCheckout(USER_3, wallet.id, 50, 'card');
    const payment = await paymentRepo.findByUserId(USER_3, 1, 0);
    const stripeSessionId = payment.rows[0]!.stripeSessionId!;

    const webhookBody = buildWebhookEvent(stripeSessionId, 5000, {
      walletId: wallet.id,
      userId: USER_3,
      paymentId: 'pay_test',
    });

    // Process twice
    await service.handleWebhook('valid-sig', webhookBody);
    await service.handleWebhook('valid-sig', webhookBody);

    // Wallet should only be credited once
    const funded = await walletRepo.findById(wallet.id);
    expect(parseFloat(funded!.balance)).toBe(50);
  });

  // Test 5: 10 concurrent duplicate webhooks — credited exactly once
  it('should credit exactly once under 10 concurrent webhook deliveries', async () => {
    const wallet = await walletService.createWallet(USER_4);
    const { service } = createPaymentService();

    await service.createCheckout(USER_4, wallet.id, 100, 'card');
    const payment = await paymentRepo.findByUserId(USER_4, 1, 0);
    const stripeSessionId = payment.rows[0]!.stripeSessionId!;

    const webhookBody = buildWebhookEvent(stripeSessionId, 10000, {
      walletId: wallet.id,
      userId: USER_4,
      paymentId: 'pay_test',
    });

    // Fire 10 concurrent webhooks
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => service.handleWebhook('valid-sig', webhookBody)),
    );

    // All should succeed (no throws — duplicates are no-ops)
    const errors = results.filter(r => r.status === 'rejected');
    expect(errors.length).toBe(0);

    // Wallet credited exactly once
    const funded = await walletRepo.findById(wallet.id);
    expect(parseFloat(funded!.balance)).toBe(100);
  });

  // Test 6: Invalid signature
  it('should reject webhook with invalid signature', async () => {
    const mockStripe = new MockStripeClient();
    mockStripe.shouldFailSignature = true;
    const { service } = createPaymentService(mockStripe);

    const webhookBody = Buffer.from('{}');

    await expect(
      service.handleWebhook('bad-sig', webhookBody),
    ).rejects.toThrow('signature');
  });

  // Test 7: Webhook for non-existent wallet
  it('should mark payment failed when wallet does not exist', async () => {
    const wallet = await walletService.createWallet(USER_5);
    const { service } = createPaymentService();

    await service.createCheckout(USER_5, wallet.id, 10, 'card');
    const payment = await paymentRepo.findByUserId(USER_5, 1, 0);
    const stripeSessionId = payment.rows[0]!.stripeSessionId!;

    // Build webhook with a fake (non-existent) wallet ID
    const webhookBody = buildWebhookEvent(stripeSessionId, 1000, {
      walletId: '00000000-0000-0000-0000-000000000099',
      userId: USER_5,
      paymentId: 'pay_test',
    });

    await service.handleWebhook('valid-sig', webhookBody);

    // Payment should be marked failed
    const failedPayment = await paymentRepo.findByStripeSessionId(stripeSessionId);
    expect(failedPayment!.status).toBe('failed');
    expect(failedPayment!.failureReason).toBe('wallet_not_found');
  });

  // Test 8: Payment history
  it('should return paginated payment history', async () => {
    const wallet = await walletService.createWallet(USER_6);
    const { service } = createPaymentService();

    // Create 3 checkouts
    await service.createCheckout(USER_6, wallet.id, 10, 'card');
    await service.createCheckout(USER_6, wallet.id, 20, 'ach');
    await service.createCheckout(USER_6, wallet.id, 30, 'card');

    const result = await service.getPaymentHistory(USER_6, 2, 0);
    expect(result.payments.length).toBe(2);
    expect(result.total).toBe(3);
    expect(result.limit).toBe(2);
    expect(result.offset).toBe(0);

    const page2 = await service.getPaymentHistory(USER_6, 2, 2);
    expect(page2.payments.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd /Users/drpraize/agntly && ./node_modules/.bin/vitest run --config vitest.integration.config.ts`
Expected: All 8 new tests pass alongside the existing 18 tests (26 total).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/payments.test.ts
git commit -m "test: add payment integration tests with mocked Stripe and concurrent webhook testing"
```

---

## Summary

| Task | What it does | Files touched |
|------|-------------|---------------|
| 1 | Add stripe dep + unique constraint | `package.json`, `db/schema.ts`, `migrate.sql` |
| 2 | StripeClient (injectable) | `services/stripe-client.ts` (new) |
| 3 | PaymentRepository with CAS | `repositories/payment-repository.ts` (new) |
| 4 | PaymentService with transactions | `services/payment-service.ts` (new) |
| 5 | Webhook route with raw body parser | `routes/webhook.ts` (new) |
| 6 | Real checkout + history routes | `routes/payments.ts` (rewrite) |
| 7 | Wire everything into server.ts | `server.ts` (rewrite) |
| 8 | Integration tests (8 cases) | `tests/integration/payments.test.ts` (new) |

**Total: 8 tasks, ~10 files, proving idempotent payment flow under concurrent load.**

**Critical correctness properties tested:**
- CAS atomic `markCompleted` prevents double-credit (Test 4)
- 10 concurrent webhooks credit exactly once (Test 5)
- `markCompleted` + `creditBalance` in single DB transaction (Tests 3-5)
- Wallet ownership verified before checkout (Test 2)
- Non-existent wallet → payment failed, no credit (Test 7)
