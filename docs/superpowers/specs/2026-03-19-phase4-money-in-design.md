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
- `markCompleted(id, usdcAmount)` — Set status=completed, completedAt, usdcAmount
- `markFailed(id, reason)` — Set status=failed, failureReason

Uses Drizzle typed queries for reads, `db.execute(sql)` for atomic status transitions (same pattern as wallet/escrow/task repositories).

### 2. PaymentService

Business logic layer:

**`createCheckout(userId, walletId, amountUsd, method)`**
- Validates wallet exists (imports WalletRepository from wallet-service)
- Creates Stripe Checkout Session via stripe-client
- Records pending payment in DB with stripe_session_id
- Returns `{ paymentId, checkoutUrl, expiresAt }`

**`handleWebhook(signature, rawBody)`**
- Verifies Stripe webhook signature via `stripe.webhooks.constructEvent()`
- Extracts session data from `checkout.session.completed` event
- Idempotency check: looks up `stripe_session_id` — if already completed, returns 200 OK
- Calculates USDC amount: `amountReceived` from Stripe (after their fees)
- Credits wallet via WalletRepository.creditBalance()
- Marks payment as completed
- Publishes `wallet.funded` event via EventBus

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

### 4. Cross-Service Communication

Payment-service imports WalletRepository directly from the wallet-service package (same monorepo, shared database). This avoids HTTP calls for the critical credit operation and ensures atomicity. The EventBus publishes `wallet.funded` after successful crediting for downstream consumers (webhooks, analytics).

## Idempotency

The `stripe_session_id` column is used as the idempotency key:
1. Before processing a webhook, query `findByStripeSessionId(sessionId)`
2. If found and status=completed → return 200 OK (duplicate webhook)
3. If found and status=pending → process the payment
4. If not found → log error (orphaned webhook), return 200 OK

This handles both Stripe webhook retries and any race conditions in webhook delivery.

## Fee Handling

- Card payments: Stripe charges ~2.9% + $0.30 — passed through to user
- ACH payments: Stripe charges 0.8% capped at $5 — lower cost for larger amounts
- No additional Agntly fee on funding — platform revenue comes from 3% escrow fee on task payments
- USDC credited = `amount_received` from Stripe webhook (post-Stripe-fee amount)

In Stripe test mode, `amount_received` equals `amount_total` (no real fees deducted). The code handles both cases by using `amount_received` when available, falling back to `amount_total`.

## Error Cases

| Scenario | Handling |
|---|---|
| Stripe Checkout expires (30 min default) | Payment stays `pending`, no credit. Cleanup job can mark stale pending payments as `expired`. |
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

## Testing Strategy

Integration tests use a **mocked Stripe client** (injected via constructor) to avoid hitting real Stripe APIs. The mock:
- `createCheckoutSession()` → returns a fake session ID and URL
- `verifyWebhookSignature()` → returns a pre-built event object

Test cases:
1. Create checkout → returns URL and pending payment in DB
2. Webhook with valid signature → wallet credited, payment marked completed
3. Duplicate webhook → no double-credit, returns 200
4. Webhook with invalid signature → returns 400, no credit
5. Webhook for non-existent wallet → payment marked failed
6. Payment history pagination

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
