# Phase 4: Money In — Stripe Checkout → Wallet Funding

## Overview

Users fund their Agntly wallets through Stripe Checkout Sessions. Two payment methods: card (instant) and ACH bank transfer (1-3 days). On successful payment, a Stripe webhook fires, the payment-service records it, and credits the user's wallet via the wallet-service's `creditBalance` operation. Idempotency prevents double-crediting.

## Architecture

```
  User                Payment Service              Stripe               Wallet Service
  ────                ───────────────              ──────               ──────────────
   │                        │                         │                        │
   │──POST /checkout───────▶│                         │                        │
   │                        │──Create Checkout────────▶│                        │
   │                        │◀─Session URL─────────────│                        │
   │◀─Redirect URL──────────│                         │                        │
   │                        │                         │                        │
   │──Pays on Stripe──────────────────────────────────▶│                        │
   │                        │                         │                        │
   │                        │◀─Webhook: checkout.session.completed─────────────│
   │                        │                         │                        │
   │                        │  Verify signature                                │
   │                        │  Check idempotency                               │
   │                        │  Record payment                                  │
   │                        │──creditBalance(walletId, usdcAmount)────────────▶│
   │                        │                         │                        │
   │                        │──Publish wallet.funded event──────────────────────│
```

## Components

### 1. PaymentRepository

CRUD for the `payments` table. Key operations:
- `create(data)` — Insert pending payment with Stripe session ID
- `findByStripeSessionId(sessionId)` — Idempotency lookup
- `findById(id)` — Get payment details
- `findByUserId(userId, limit, offset)` — Payment history with pagination
- `markCompleted(stripeSessionId, usdcAmount)` — Atomic compare-and-swap: `UPDATE payments SET status='completed', usdc_amount=$2, completed_at=NOW() WHERE stripe_session_id=$1 AND status='pending' RETURNING id`. Returns the payment ID if transition succeeded, null if already completed (idempotent). This is the idempotency guard — no separate read needed.
- `markFailed(id, reason)` — Atomic: `UPDATE payments SET status='failed', failure_reason=$2 WHERE id=$1 AND status='pending' RETURNING id`

Uses Drizzle typed queries for reads, `db.execute(sql)` for atomic status transitions (same pattern as wallet/escrow/task repositories).

**CRITICAL:** The `stripe_session_id` column MUST have a UNIQUE constraint in the DB schema. Add `.unique()` to the Drizzle schema definition.

### 2. PaymentService

Business logic layer:

**`createCheckout(userId, walletId, amountUsd, method)`**
- Validates wallet exists (imports WalletRepository from wallet-service)
- Creates Stripe Checkout Session via stripe-client
- Records pending payment in DB with stripe_session_id
- Returns `{ paymentId, checkoutUrl, expiresAt }`

**`handleWebhook(signature, rawBody)`**
- Verifies Stripe webhook signature via `stripe.webhooks.constructEvent()` — `rawBody` must be the unparsed Buffer (see Raw Body section below)
- Only handles `checkout.session.completed` events; ignores all others with 200 OK
- Extracts `session.id`, `session.amount_total`, and `session.metadata` (walletId, userId, paymentId)
- Calculates USDC amount: `amount_total / 100` (Stripe amounts are in cents). In test mode this equals the full amount; in live mode Stripe fees are deducted before payout but `amount_total` reflects what the user paid
- **Atomic idempotent credit** (single DB transaction):
  1. Call `paymentRepo.markCompleted(stripeSessionId, usdcAmount)` — atomic CAS UPDATE
  2. If returns null → already processed (duplicate webhook), return 200 OK
  3. If returns paymentId → call `walletRepo.creditBalance(walletId, usdcAmount)`
  4. Both operations MUST execute within a single DB transaction. If `creditBalance` fails, the `markCompleted` is rolled back.
- Publishes `wallet.funded` event via EventBus with payload: `{ paymentId, walletId, userId, usdcAmount, method, stripeSessionId }`

**`getPaymentHistory(userId, limit, offset)`**
- Returns paginated payment history

### 3. StripeClient

Thin wrapper around the `stripe` npm package:

**`createCheckoutSession(params)`**
- Creates a Stripe Checkout Session in test mode
- `payment_method_types: ['card']` for card method
- `payment_method_types: ['us_bank_account']` for ACH method
- Sets `success_url` and `cancel_url` (configurable via env)
- Attaches `metadata: { walletId, userId, paymentId }` for webhook correlation
- Returns `{ sessionId, url }`

**`verifyWebhookSignature(signature, rawBody)`**
- Calls `stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)`
- Returns the parsed Stripe event or throws

Configured via env vars:
- `STRIPE_SECRET_KEY` — test mode key (sk_test_...)
- `STRIPE_WEBHOOK_SECRET` — webhook endpoint signing secret (whsec_...)
- `STRIPE_SUCCESS_URL` — redirect after payment (default: http://localhost:3000/wallet?funded=true)
- `STRIPE_CANCEL_URL` — redirect on cancel (default: http://localhost:3000/wallet?canceled=true)

### 4. Raw Body Handling for Webhook

**CRITICAL:** Stripe's `constructEvent()` requires the raw, unparsed request body bytes. Fastify's default JSON parser will break signature verification. The webhook route MUST register a raw body parser:

```typescript
// In the webhook route registration (before the handler):
app.addContentTypeParser(
  'application/json',
  { parseAs: 'buffer' },
  (_req, body, done) => done(null, body),
);
```

This must be scoped only to the webhook sub-route (register it in a separate Fastify plugin/prefix). The handler receives `request.body` as a `Buffer` and passes it directly to `verifyWebhookSignature`.

### 5. Cross-Service Communication

Payment-service imports WalletRepository directly from the wallet-service package:
```typescript
import { WalletRepository } from '../../wallet-service/src/repositories/wallet-repository.js';
```

Same monorepo, shared database — avoids HTTP calls for the critical credit operation. Both `paymentRepo.markCompleted()` and `walletRepo.creditBalance()` execute within a single DB transaction for atomicity.

### 6. Authentication

- `POST /v1/payments/checkout` — Requires authentication (JWT or API key via auth middleware). The `userId` comes from the auth context, not the request body. The handler verifies the `walletId` belongs to the authenticated `userId` before creating the checkout session.
- `POST /v1/payments/webhook` — No auth (Stripe calls this). Authenticated via Stripe webhook signature verification instead.
- `GET /v1/payments/history` — Requires authentication. Returns only the authenticated user's payments.

## Idempotency

Idempotency is enforced via the atomic `markCompleted` CAS operation — NOT via a separate read-then-write:

1. Webhook arrives with `stripe_session_id`
2. Call `markCompleted(stripeSessionId, usdcAmount)` — this is an atomic `UPDATE ... WHERE status='pending' RETURNING id`
3. If returns a row → first processor wins. Proceed to `creditBalance` within the same transaction.
4. If returns nothing → either already completed (duplicate webhook) or payment not found. Return 200 OK either way.

This eliminates the TOCTOU race condition where two concurrent webhook deliveries could both see `pending` and both credit. The `stripe_session_id` UNIQUE constraint provides a secondary safety net.

**DB transaction boundary:** `markCompleted` + `creditBalance` are wrapped in a single PostgreSQL transaction. If either fails, both roll back. No money is created without a corresponding payment record, and no payment is marked completed without the wallet being credited.

## Input Validation

Checkout endpoint uses Zod schema:
```typescript
const checkoutSchema = z.object({
  walletId: z.string().uuid(),
  amountUsd: z.number().positive().min(1).max(10000),
  method: z.enum(['card', 'ach']),
});
```

The handler also verifies `walletId` belongs to the authenticated `userId` before proceeding.

## Fee Handling

- Card payments: Stripe charges ~2.9% + $0.30 — passed through to user
- ACH payments: Stripe charges 0.8% capped at $5 — lower cost for larger amounts
- No additional Agntly fee on funding — platform revenue comes from 3% escrow fee on task payments
- USDC credited = `session.amount_total / 100` from the Stripe Checkout Session completed event. `amount_total` is in cents (integer). In test mode this equals the full amount. In live mode, Stripe fees are deducted at payout time (not from `amount_total`), so the user's wallet is credited with the full amount they paid.
- The `usdc_direct` method in the DB schema is not supported in this phase — the Zod enum restricts to `card | ach` only.

## Error Cases

| Scenario | Handling |
|---|---|
| Stripe Checkout expires (24h default) | Payment stays `pending`, no credit. Deferred: a cleanup cron job to mark stale pending payments as `expired` (Phase 6). |
| Webhook signature invalid | Return 400, log structured error with request details |
| Webhook fires twice (Stripe retry) | Idempotency via `stripe_session_id` lookup — second call is a no-op returning 200 |
| Wallet doesn't exist at webhook time | Log error, mark payment `failed` with reason `wallet_not_found`, return 200 to Stripe |
| DB connection failure during webhook | Return 500, Stripe retries with exponential backoff (up to 72h) |
| User cancels on Stripe Checkout page | No webhook fires, payment stays `pending` |

## API Endpoints

### POST /v1/payments/checkout
Create a Stripe Checkout Session.

**Request:**
```json
{
  "walletId": "uuid",
  "amountUsd": 10.00,
  "method": "card" | "ach"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "paymentId": "pay_xxxx",
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
    "amountUsd": 10.00,
    "method": "card",
    "expiresAt": "2026-03-19T19:30:00Z"
  }
}
```

### POST /v1/payments/webhook
Stripe webhook receiver. Raw body required (no JSON parsing).

**Headers:** `stripe-signature: t=...,v1=...`

**Response:** 200 `{ received: true }` or 400 on signature failure.

### GET /v1/payments/history?limit=20&offset=0
Paginated payment history for the authenticated user.

**Response (200):**
```json
{
  "success": true,
  "data": [...payments],
  "meta": { "total": 42, "limit": 20, "offset": 0 }
}
```

## Files

| Action | Path | Purpose |
|--------|------|---------|
| Create | `services/payment-service/src/repositories/payment-repository.ts` | Payment CRUD + idempotency lookup |
| Create | `services/payment-service/src/services/payment-service.ts` | Business logic: checkout + webhook handling |
| Create | `services/payment-service/src/services/stripe-client.ts` | Stripe SDK wrapper (Checkout Sessions + webhook verification) |
| Modify | `services/payment-service/src/routes/payments.ts` | Replace stubs with real handlers |
| Modify | `services/payment-service/src/server.ts` | Wire DB + EventBus + Stripe + WalletRepo |
| Modify | `services/payment-service/package.json` | Add `stripe` dependency |
| Create | `tests/integration/payments.test.ts` | Payment flow tests with mocked Stripe |
| Modify | `services/payment-service/src/db/schema.ts` | Add `.unique()` to `stripeSessionId` column |
| Modify | `.env.example` | Add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET env vars |

## Testing Strategy

Integration tests use a **mocked Stripe client** (injected via constructor) to avoid hitting real Stripe APIs. The mock:
- `createCheckoutSession()` → returns a fake session ID and URL
- `verifyWebhookSignature()` → returns a pre-built event object

Test cases:
1. Create checkout → returns URL and pending payment in DB
2. Create checkout for wallet not owned by user → returns 403
3. Webhook with valid signature → wallet credited, payment marked completed
4. Duplicate webhook → no double-credit, returns 200
5. 10 concurrent duplicate webhooks → wallet credited exactly once
6. Webhook with invalid signature → returns 400, no credit
7. Webhook for non-existent wallet → payment marked failed
8. Payment history pagination

## Environment Variables

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=http://localhost:3000/wallet?funded=true
STRIPE_CANCEL_URL=http://localhost:3000/wallet?canceled=true
```

For local development with Stripe webhook forwarding:
```bash
stripe listen --forward-to localhost:3006/v1/payments/webhook
```
