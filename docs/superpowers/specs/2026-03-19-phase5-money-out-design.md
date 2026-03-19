# Phase 5: Money Out — Withdrawal → On-Chain USDC Transfer

## Overview

Agent builders withdraw earned USDC from their Agntly wallet to any external address. The wallet-service debits the balance (already built), records a withdrawal record, and publishes a `wallet.withdrawn` event. The settlement-worker picks up the event and submits an on-chain USDC `transfer()` to the destination address on Base Sepolia. The withdrawal record is updated with the txHash once confirmed.

## Architecture

```
  Builder             Wallet Service           Settlement Worker          Base L2
  ───────             ──────────────           ─────────────────          ───────
   │                        │                         │                      │
   │──POST /withdraw───────▶│                         │                      │
   │                        │  Validate destination   │                      │
   │                        │  debitBalance (atomic)   │                      │
   │                        │  Record withdrawal       │                      │
   │                        │──Event: wallet.withdrawn─▶│                      │
   │◀─withdrawalId + status─│                         │                      │
   │                        │                         │──USDC.transfer()────▶│
   │                        │                         │◀─txHash──────────────│
   │                        │                         │──Update withdrawal───│
   │                        │                         │  status=completed     │
   │                        │                         │  txHash=0x...         │
```

## Components

### 1. WithdrawalRepository

CRUD for the `withdrawals` table (already exists in DB schema). Key operations:
- `create(data)` — Insert withdrawal with status `queued`
- `findById(id)` — Get withdrawal details
- `findByWalletId(walletId, limit, offset)` — Paginated withdrawal history
- `markProcessing(id)` — Atomic CAS: `UPDATE withdrawals SET status='processing' WHERE id=$1 AND status='queued' RETURNING id`. Prevents duplicate processing from concurrent event handlers.
- `markCompleted(id, txHash)` — Atomic CAS: `UPDATE withdrawals SET status='completed', tx_hash=$2 WHERE id=$1 AND status='processing' RETURNING id`
- `markFailed(id)` — Atomic CAS: `UPDATE withdrawals SET status='failed' WHERE id=$1 AND status='processing' RETURNING id`. Failures are logged server-side with full context (error message, tx details). No `failureReason` column — admin investigates via logs.

All `create()` calls use `.returning()` to get the DB-generated UUID back. The returned `id` is placed in the `wallet.withdrawn` event payload as `withdrawalId`.

Uses Drizzle typed queries for reads, `db.execute(sql)` for atomic status transitions (same pattern as payment/escrow/task repositories).

### 2. WalletService Extension

Extend the existing `withdraw()` method. The balance debit and withdrawal record creation MUST be in a single DB transaction to prevent balance loss on crash:

```
1. Verify wallet exists AND belongs to the authenticated user (wallet.ownerId === userId)
2. Validate destination address via viem isAddress(destination, { strict: true }) for EIP-55 checksum
3. Reject zero address (0x0000...0000)
4. BEGIN TRANSACTION (raw pg.Pool client, same pattern as PaymentService.handleWebhook):
   a. Debit balance: UPDATE wallets SET balance = balance - amount WHERE id = walletId AND balance >= amount
   b. If no rows → ROLLBACK, throw "Insufficient balance"
   c. Create withdrawal record: INSERT INTO withdrawals (wallet_id, amount, destination, fee, status) VALUES (...)
   d. COMMIT
5. Publish wallet.withdrawn event with withdrawalId (from the INSERT RETURNING id)
6. Return { withdrawalId, amount, destination, fee, status: 'queued' }
```

The `WithdrawalRepository` is injected via constructor alongside `WalletRepository`. The `pg.Pool` is also injected (same as PaymentService) for raw transaction control.

**Authorization:** The route handler MUST verify `wallet.ownerId === request.userId` before calling `withdraw()`. This prevents one user from draining another user's wallet. The service method accepts `userId` as a parameter and performs the ownership check internally.

### 3. Settlement-Worker Extension

The settlement-worker already has GasManager + viem + event subscription. Add a handler for `wallet.withdrawn` events:

```
1. Extract withdrawalId, destination, amount from event data
2. markProcessing(withdrawalId) — CAS guard, only first processor wins
3. If CAS fails → already processing/completed, skip
4. Submit USDC transfer: usdc.transfer(destination, amount) on-chain
5. Wait for receipt
6. If success → markCompleted(withdrawalId, txHash)
7. If reverted → markFailed(withdrawalId)
```

The USDC contract ABI needed: `transfer(address to, uint256 amount)`. The USDC contract address on Base Sepolia is configured via `USDC_CONTRACT_ADDRESS` env var.

Both the settlement-worker and wallet-service use the same database, so the settlement-worker can import `WithdrawalRepository` directly (same monorepo pattern as payment-service importing WalletRepository).

### 4. Withdrawal Status + History Endpoint

Add to wallet routes:
- `GET /v1/wallets/:walletId/withdrawals` — Paginated withdrawal history for a wallet. Returns status and txHash so builders can see on-chain receipts.

### 5. Destination Address Validation

Zod schema for the withdraw endpoint:
```typescript
import { isAddress } from 'viem';

const withdrawSchema = z.object({
  amount: z.string()
    .refine(val => /^\d+(\.\d{1,6})?$/.test(val), 'Amount must be a positive number with up to 6 decimal places')
    .refine(val => parseFloat(val) > 0, 'Amount must be greater than zero'),
  destination: z.string()
    .refine(val => isAddress(val, { strict: true }), 'Invalid Ethereum address (EIP-55 checksum required)')
    .refine(val => val !== '0x0000000000000000000000000000000000000000', 'Cannot withdraw to zero address'),
});
```

The `instant` flag is **NOT included** in Phase 5 scope. All withdrawals go through the same queued pipeline. The `instant` flag and its associated fee logic can be added in a future phase if differentiated processing speeds are needed. The existing `instant` parameter in `WalletService.withdraw()` is ignored — all withdrawals return `status: 'queued'` with `fee: '0.000000'`.

Note: The amount regex accepts `"5"`, `"5.5"`, and `"5.500000"` — all valid. The service normalizes to 6 decimal places before DB insertion.

## Error Cases

| Scenario | Handling |
|---|---|
| Insufficient balance | `debitBalance` returns false → 400 "Insufficient available balance" (already built) |
| Invalid destination address | Zod validation rejects → 400 "Invalid Ethereum address" |
| Zero address destination | Additional check → 400 "Cannot withdraw to zero address" |
| On-chain transfer reverts | Withdrawal marked `failed`, balance NOT auto-refunded. Admin investigates manually. Rationale: auto-refund without understanding why the tx failed could mask a bug. |
| Gas wallet empty | GasManager.checkGasBalance() throws → withdrawal stays `queued`, retried on next event delivery |
| Settlement-worker down | Event stays in Redis Stream, processed when worker comes back up |
| Duplicate event delivery | `markProcessing` CAS guard: only first processor wins. Second attempt finds status != 'queued' and skips. |
| Withdrawal created but event lost | Deferred: a reconciliation cron that scans for `queued` withdrawals older than 5 minutes and re-publishes the event. Not in Phase 5 scope. |

## API Endpoints

### POST /v1/wallets/:walletId/withdraw (existing, enhanced)

Already exists. Enhanced with:
- Zod validation for destination address and amount format
- Persists withdrawal record in DB
- Returns withdrawalId for status tracking

**Request:**
```json
{
  "amount": "5.000000",
  "destination": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD12",
  "instant": false
}
```

**Response (202):**
```json
{
  "success": true,
  "data": {
    "withdrawalId": "wth_xxxx",
    "amount": "5.000000",
    "destination": "0x742d...",
    "fee": "0.000000",
    "status": "queued"
  }
}
```

### GET /v1/wallets/:walletId/withdrawals?limit=20&offset=0 (new)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "amount": "5.000000",
      "destination": "0x742d...",
      "fee": "0.000000",
      "txHash": "0xabc...",
      "status": "completed",
      "createdAt": "2026-03-19T..."
    }
  ],
  "error": null,
  "meta": { "total": 3, "limit": 20, "offset": 0 }
}
```

## Files

| Action | Path | Purpose |
|--------|------|---------|
| Create | `services/wallet-service/src/repositories/withdrawal-repository.ts` | Withdrawal CRUD + CAS status transitions |
| Modify | `services/wallet-service/src/services/wallet-service.ts` | Persist withdrawal record, validate destination |
| Modify | `services/wallet-service/src/routes/wallets.ts` | Add Zod validation, withdrawal history endpoint |
| Modify | `services/wallet-service/src/server.ts` | Initialize WithdrawalRepository, inject into WalletService |
| Modify | `services/settlement-worker/src/services/settlement-service.ts` | Add USDC transfer handler for wallet.withdrawn |
| Modify | `services/settlement-worker/src/server.ts` | Add `'wallet.withdrawn'` to the EXISTING events array in the single `subscribe()` call (do NOT create a second subscribe). Initialize WithdrawalRepository. |
| Create | `tests/integration/withdrawals.test.ts` | Withdrawal flow + concurrent tests |

## Testing Strategy

Integration tests use real PostgreSQL (same setup as existing tests). Settlement-worker on-chain logic is NOT tested (requires chain — that's an E2E test). We test the off-chain flow: balance debit → withdrawal record → status transitions.

Test cases:
1. Withdraw → balance debited, withdrawal record created with status `queued`
2. Invalid destination address → rejected with 400
3. Zero address → rejected with 400
4. Insufficient balance → rejected, no withdrawal record created
5. Withdrawal history returns correct records with pagination
6. 20 concurrent withdrawals on $10 wallet → at most 9 succeed, balance never negative
7. markProcessing CAS → only one processor wins under concurrent calls

## Environment Variables

```env
USDC_CONTRACT_ADDRESS=0x...  # USDC on Base Sepolia (already needed by settlement-worker)
```
