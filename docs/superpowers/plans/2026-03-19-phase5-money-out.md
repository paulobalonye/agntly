# Phase 5: Money Out — Withdrawal → On-Chain USDC Transfer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let agent builders withdraw earned USDC to any external wallet address, with atomic balance debit + withdrawal record creation in a single DB transaction, and on-chain USDC transfer via the settlement-worker.

**Architecture:** WithdrawalRepository handles CRUD + CAS status transitions for the existing `withdrawals` table. WalletService.withdraw() is rewritten to use a raw pg transaction wrapping both the balance debit and withdrawal record insert. The settlement-worker adds a `wallet.withdrawn` event handler that submits USDC `transfer()` on-chain via viem. Destination addresses are validated with viem's EIP-55 checksum. The `instant` flag is removed from Phase 5 scope.

**Tech Stack:** Drizzle ORM, PostgreSQL, viem (isAddress + on-chain transfer), Redis Streams EventBus, Zod, Vitest

---

## File Structure

### New files
- `services/wallet-service/src/repositories/withdrawal-repository.ts` — Withdrawal CRUD + CAS
- `tests/integration/withdrawals.test.ts` — 7 test cases

### Modified files
- `services/wallet-service/src/services/wallet-service.ts` — Transactional withdraw with auth check
- `services/wallet-service/src/routes/wallets.ts` — EIP-55 validation, withdrawal history endpoint
- `services/wallet-service/src/server.ts` — Wire WithdrawalRepository + pg.Pool
- `services/settlement-worker/src/services/settlement-service.ts` — Add USDC transfer handler
- `services/settlement-worker/src/server.ts` — Add wallet.withdrawn to subscribe list

---

## Task 1: Create WithdrawalRepository

**Files:**
- Create: `services/wallet-service/src/repositories/withdrawal-repository.ts`

- [ ] **Step 1: Write the WithdrawalRepository**

Create `services/wallet-service/src/repositories/withdrawal-repository.ts`:

```typescript
import { eq, sql, desc } from 'drizzle-orm';
import type { DbConnection } from '@agntly/shared';
import { withdrawals } from '../db/schema.js';

export interface WithdrawalRow {
  readonly id: string;
  readonly walletId: string;
  readonly amount: string;
  readonly destination: string;
  readonly fee: string;
  readonly txHash: string | null;
  readonly status: string;
  readonly createdAt: Date;
}

export class WithdrawalRepository {
  constructor(private readonly db: DbConnection) {}

  async create(data: {
    walletId: string;
    amount: string;
    destination: string;
    fee: string;
  }): Promise<WithdrawalRow> {
    const [row] = await this.db
      .insert(withdrawals)
      .values({
        walletId: data.walletId,
        amount: data.amount,
        destination: data.destination,
        fee: data.fee,
        status: 'queued',
      })
      .returning();
    return row as unknown as WithdrawalRow;
  }

  async findById(id: string): Promise<WithdrawalRow | null> {
    const [row] = await this.db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.id, id))
      .limit(1);
    return (row as unknown as WithdrawalRow) ?? null;
  }

  async findByWalletId(
    walletId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ rows: readonly WithdrawalRow[]; total: number }> {
    const rows = await this.db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.walletId, walletId))
      .orderBy(desc(withdrawals.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(withdrawals)
      .where(eq(withdrawals.walletId, walletId));

    return {
      rows: rows as unknown as WithdrawalRow[],
      total: countResult?.count ?? 0,
    };
  }

  /**
   * Atomic CAS: queued → processing. Only first processor wins.
   */
  async markProcessing(id: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE withdrawals
      SET status = 'processing'
      WHERE id = ${id}::uuid
        AND status = 'queued'
      RETURNING id
    `);
    return (result.rows?.length ?? 0) > 0;
  }

  /**
   * Atomic CAS: processing → completed with txHash.
   */
  async markCompleted(id: string, txHash: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE withdrawals
      SET status = 'completed', tx_hash = ${txHash}
      WHERE id = ${id}::uuid
        AND status = 'processing'
      RETURNING id
    `);
    return (result.rows?.length ?? 0) > 0;
  }

  /**
   * Atomic CAS: processing → failed.
   */
  async markFailed(id: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE withdrawals
      SET status = 'failed'
      WHERE id = ${id}::uuid
        AND status = 'processing'
      RETURNING id
    `);
    return (result.rows?.length ?? 0) > 0;
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/wallet-service build`

- [ ] **Step 3: Commit**

```bash
git add services/wallet-service/src/repositories/withdrawal-repository.ts
git commit -m "feat: add WithdrawalRepository with CAS status transitions"
```

---

## Task 2: Rewrite WalletService.withdraw() with transaction + auth

The existing `withdraw()` debits balance then publishes an event — no withdrawal record, no transaction, no auth check. This rewrite wraps `debitBalance` + `create withdrawal` in a single DB transaction using a raw pg.Pool client, adds wallet ownership verification, and removes the `instant` flag.

**Files:**
- Modify: `services/wallet-service/src/services/wallet-service.ts`
- Modify: `services/wallet-service/src/server.ts`

- [ ] **Step 1: Update WalletService constructor and withdraw method**

In `services/wallet-service/src/services/wallet-service.ts`:

1. Add imports:
```typescript
import pg from 'pg';
import type { WithdrawalRepository, WithdrawalRow } from '../repositories/withdrawal-repository.js';
```

2. Change constructor to accept `WithdrawalRepository` and `pg.Pool`:
```typescript
constructor(
  private readonly repo: WalletRepository,
  private readonly withdrawalRepo: WithdrawalRepository,
  private readonly pool: pg.Pool,
  private readonly eventBus?: EventBus,
) {}
```

3. Replace the entire `withdraw()` method:
```typescript
async withdraw(
  userId: string,
  walletId: string,
  amount: string,
  destination: string,
): Promise<{
  withdrawalId: string;
  amount: string;
  destination: string;
  fee: string;
  status: string;
}> {
  // Verify wallet exists and belongs to the caller
  const wallet = await this.repo.findById(walletId);
  if (!wallet) throw new Error('Wallet not found');
  if (wallet.ownerId !== userId) throw new Error('Wallet does not belong to user');

  // Normalize amount to 6 decimal places
  const normalizedAmount = parseFloat(amount).toFixed(6);
  const fee = '0.000000';

  // Atomic transaction: debit balance + create withdrawal record
  const client = await this.pool.connect();
  let withdrawalId: string;
  try {
    await client.query('BEGIN');

    // Debit balance with guard
    const debitResult = await client.query(
      `UPDATE wallets SET balance = balance - $2::numeric, updated_at = NOW()
       WHERE id = $1::uuid AND balance >= $2::numeric
       RETURNING id`,
      [walletId, normalizedAmount],
    );

    if (debitResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('Insufficient available balance');
    }

    // Create withdrawal record
    const insertResult = await client.query(
      `INSERT INTO withdrawals (wallet_id, amount, destination, fee, status)
       VALUES ($1::uuid, $2::numeric, $3, $4::numeric, 'queued')
       RETURNING id`,
      [walletId, normalizedAmount, destination, fee],
    );

    withdrawalId = insertResult.rows[0].id;
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Publish event (outside transaction — best effort)
  if (this.eventBus) {
    await this.eventBus.publish('wallet.withdrawn', {
      withdrawalId,
      walletId,
      amount: normalizedAmount,
      destination,
      fee,
    });
  }

  return {
    withdrawalId,
    amount: normalizedAmount,
    destination,
    fee,
    status: 'queued',
  };
}
```

- [ ] **Step 2: Add getWithdrawalHistory method**

Add to WalletService:
```typescript
async getWithdrawalHistory(
  walletId: string,
  limit: number = 20,
  offset: number = 0,
): Promise<{ withdrawals: readonly WithdrawalRow[]; total: number; limit: number; offset: number }> {
  const { rows, total } = await this.withdrawalRepo.findByWalletId(walletId, limit, offset);
  return { withdrawals: rows, total, limit, offset };
}
```

- [ ] **Step 3: Update server.ts to wire WithdrawalRepository + Pool**

In `services/wallet-service/src/server.ts`:

1. Add imports:
```typescript
import { createPool } from '@agntly/shared';
import { WithdrawalRepository } from './repositories/withdrawal-repository.js';
```

2. Add pool and withdrawal repo initialization after existing `walletRepo`:
```typescript
const pool = createPool();
const withdrawalRepo = new WithdrawalRepository(db);
```

3. Update WalletService constructor:
```typescript
const walletService = new WalletService(walletRepo, withdrawalRepo, pool, eventBus);
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/wallet-service build`
Expected: May have errors in routes/wallets.ts since `withdraw()` signature changed — that's fixed in Task 3.

- [ ] **Step 5: Commit**

```bash
git add services/wallet-service/src/services/wallet-service.ts services/wallet-service/src/server.ts
git commit -m "feat: rewrite withdraw with transactional debit + record creation and auth check"
```

---

## Task 3: Update wallet routes with EIP-55 validation + withdrawal history

**Files:**
- Modify: `services/wallet-service/src/routes/wallets.ts`

- [ ] **Step 1: Rewrite the withdraw route and add history endpoint**

Replace `services/wallet-service/src/routes/wallets.ts` entirely:

```typescript
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { isAddress } from 'viem';
import { createApiResponse, createErrorResponse } from '@agntly/shared';
import type { WalletService } from '../services/wallet-service.js';

const createSchema = z.object({
  agentId: z.string().min(1).optional(),
  label: z.string().optional(),
});

const fundSchema = z.object({
  amountUsd: z.number().positive(),
  method: z.enum(['card', 'ach', 'usdc']),
});

const withdrawSchema = z.object({
  amount: z.string()
    .refine(val => /^\d+(\.\d{1,6})?$/.test(val), 'Amount must be a positive number with up to 6 decimal places')
    .refine(val => parseFloat(val) > 0, 'Amount must be greater than zero'),
  destination: z.string()
    .refine(val => isAddress(val, { strict: true }), 'Invalid Ethereum address (EIP-55 checksum required)')
    .refine(val => val !== '0x0000000000000000000000000000000000000000', 'Cannot withdraw to zero address'),
});

const historySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const walletRoutes: FastifyPluginAsync = async (app) => {
  const service = (app as any).walletService as WalletService;

  app.post('/', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse('Invalid input'));
    const userId = (request as any).userId ?? 'demo-user';
    const wallet = await service.createWallet(userId, parsed.data.agentId);
    return reply.status(201).send(createApiResponse(wallet));
  });

  app.get('/:walletId', async (request, reply) => {
    const { walletId } = request.params as { walletId: string };
    const wallet = await service.getWallet(walletId);
    if (!wallet) return reply.status(404).send(createErrorResponse('Wallet not found'));
    return reply.status(200).send(createApiResponse(wallet));
  });

  app.post('/:walletId/fund', async (request, reply) => {
    const { walletId } = request.params as { walletId: string };
    const parsed = fundSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send(createErrorResponse('Invalid funding request'));
    try {
      const result = await service.fundWallet(walletId, parsed.data.amountUsd, parsed.data.method);
      return reply.status(200).send(createApiResponse(result));
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Funding failed'));
    }
  });

  app.post('/:walletId/withdraw', async (request, reply) => {
    const { walletId } = request.params as { walletId: string };
    const parsed = withdrawSchema.safeParse(request.body);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Invalid withdrawal request';
      return reply.status(400).send(createErrorResponse(msg));
    }
    const userId = (request as any).userId ?? 'demo-user';
    try {
      const result = await service.withdraw(userId, walletId, parsed.data.amount, parsed.data.destination);
      return reply.status(202).send(createApiResponse(result));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Withdrawal failed';
      const status = message.includes('does not belong') ? 403 : 400;
      return reply.status(status).send(createErrorResponse(message));
    }
  });

  // GET /:walletId/withdrawals — Withdrawal history
  app.get('/:walletId/withdrawals', async (request, reply) => {
    const { walletId } = request.params as { walletId: string };
    const parsed = historySchema.safeParse(request.query);
    const { limit, offset } = parsed.success ? parsed.data : { limit: 20, offset: 0 };
    try {
      const result = await service.getWithdrawalHistory(walletId, limit, offset);
      return reply.status(200).send({
        success: true,
        data: result.withdrawals,
        error: null,
        meta: { total: result.total, limit: result.limit, offset: result.offset },
      });
    } catch (err) {
      return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Failed to get history'));
    }
  });
};
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/wallet-service build`

- [ ] **Step 3: Commit**

```bash
git add services/wallet-service/src/routes/wallets.ts
git commit -m "feat: add EIP-55 address validation and withdrawal history endpoint"
```

---

## Task 4: Add USDC transfer to settlement-worker

**Files:**
- Modify: `services/settlement-worker/src/services/settlement-service.ts`
- Modify: `services/settlement-worker/src/server.ts`

- [ ] **Step 1: Add submitWithdrawal method to SettlementService**

In `services/settlement-worker/src/services/settlement-service.ts`:

1. Add the USDC contract address and ABI at the top (alongside existing ESCROW constants):
```typescript
const USDC_CONTRACT_ADDRESS = process.env.USDC_CONTRACT_ADDRESS as `0x${string}` | undefined;

const USDC_ABI = parseAbi([
  'function transfer(address to, uint256 amount) external returns (bool)',
]);
```

2. Add the `submitWithdrawal` method to the `SettlementService` class:
```typescript
async submitWithdrawal(data: Record<string, unknown>): Promise<string | null> {
  if (!USDC_CONTRACT_ADDRESS || !this.gasManager.walletClient) {
    console.log('[Settlement] No USDC contract configured — skipping withdrawal (dev mode)');
    return null;
  }

  const hasGas = await this.gasManager.checkGasBalance();
  if (!hasGas) throw new Error('Insufficient gas balance for withdrawal');

  const destination = data.destination as string;
  const amount = data.amount as string;

  // Convert USDC amount string (e.g., "5.000000") to smallest unit (6 decimals)
  const amountSmallest = BigInt(Math.round(parseFloat(amount) * 1_000_000));

  const txHash = await this.gasManager.walletClient.writeContract({
    address: USDC_CONTRACT_ADDRESS,
    abi: USDC_ABI,
    functionName: 'transfer',
    args: [destination as `0x${string}`, amountSmallest],
    nonce: await this.gasManager.getNextNonce(),
  });

  console.log(`[Settlement] Withdrawal tx submitted: ${txHash} → ${destination} (${amount} USDC)`);

  const receipt = await this.gasManager.publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === 'reverted') {
    this.gasManager.resetNonce();
    throw new Error(`Withdrawal tx reverted: ${txHash}`);
  }

  console.log(`[Settlement] Withdrawal confirmed in block ${receipt.blockNumber}`);
  return txHash;
}
```

- [ ] **Step 2: Add wallet.withdrawn handler to settlement-worker server.ts**

In `services/settlement-worker/src/server.ts`:

1. Add `'wallet.withdrawn'` to the existing events array on line 35:
```typescript
['escrow.released', 'escrow.refunded', 'escrow.dispute_resolved', 'wallet.withdrawn'],
```

2. Add the handler case inside the existing `try` block (after the `escrow.dispute_resolved` handler):
```typescript
} else if (message.type === 'wallet.withdrawn') {
  await settlementService.submitWithdrawal(message.data);
}
```

**IMPORTANT:** Do NOT create a second `subscribe()` call. Extend the existing one.

- [ ] **Step 3: Verify build**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/settlement-worker build`

- [ ] **Step 4: Commit**

```bash
git add services/settlement-worker/src/services/settlement-service.ts services/settlement-worker/src/server.ts
git commit -m "feat: add USDC transfer handler to settlement-worker for withdrawals"
```

---

## Task 5: Write withdrawal integration tests

**Files:**
- Create: `tests/integration/withdrawals.test.ts`

- [ ] **Step 1: Write the tests**

Create `tests/integration/withdrawals.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, cleanTestDb, teardownTestDb } from './setup.js';
import { WalletRepository } from '../../services/wallet-service/src/repositories/wallet-repository.js';
import { WithdrawalRepository } from '../../services/wallet-service/src/repositories/withdrawal-repository.js';
import { WalletService } from '../../services/wallet-service/src/services/wallet-service.js';
import type { DbConnection } from '@agntly/shared';
import pg from 'pg';

const USER_1 = '00000000-0000-0000-0000-000000000001';
const USER_2 = '00000000-0000-0000-0000-000000000002';
// Valid EIP-55 checksummed address
const VALID_DEST = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

let db: DbConnection;
let pool: pg.Pool;
let walletService: WalletService;
let withdrawalRepo: WithdrawalRepository;

describe('Phase 5: Money Out — Withdrawals', () => {
  beforeAll(async () => {
    const setup = await setupTestDb();
    db = setup.db;
    pool = setup.pool;
    const walletRepo = new WalletRepository(db);
    withdrawalRepo = new WithdrawalRepository(db);
    walletService = new WalletService(walletRepo, withdrawalRepo, pool);
  });

  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await cleanTestDb(); });

  // Test 1: Successful withdrawal
  it('should debit balance and create queued withdrawal record', async () => {
    const wallet = await walletService.createWallet(USER_1);
    await walletService.fundWallet(wallet.id, 100, 'usdc');

    const result = await walletService.withdraw(USER_1, wallet.id, '10', VALID_DEST);

    expect(result.status).toBe('queued');
    expect(result.amount).toBe('10.000000');
    expect(result.destination).toBe(VALID_DEST);
    expect(result.fee).toBe('0.000000');

    // Verify balance debited
    const updated = await walletService.getWallet(wallet.id);
    expect(parseFloat(updated!.balance)).toBeCloseTo(89.5, 1); // 99.5 (after fund fee) - 10

    // Verify withdrawal record exists
    const withdrawal = await withdrawalRepo.findById(result.withdrawalId);
    expect(withdrawal).not.toBeNull();
    expect(withdrawal!.status).toBe('queued');
  });

  // Test 2: Wallet ownership check
  it('should reject withdrawal from wallet not owned by user', async () => {
    const wallet = await walletService.createWallet(USER_1);
    await walletService.fundWallet(wallet.id, 100, 'usdc');

    await expect(
      walletService.withdraw(USER_2, wallet.id, '10', VALID_DEST),
    ).rejects.toThrow('does not belong');

    // Balance unchanged
    const w = await walletService.getWallet(wallet.id);
    expect(parseFloat(w!.balance)).toBeCloseTo(99.5, 1);
  });

  // Test 3: Insufficient balance
  it('should reject withdrawal when insufficient balance', async () => {
    const wallet = await walletService.createWallet(USER_1);
    await walletService.fundWallet(wallet.id, 5, 'usdc');

    await expect(
      walletService.withdraw(USER_1, wallet.id, '100', VALID_DEST),
    ).rejects.toThrow('Insufficient');
  });

  // Test 4: Withdrawal history
  it('should return paginated withdrawal history', async () => {
    const wallet = await walletService.createWallet(USER_1);
    await walletService.fundWallet(wallet.id, 100, 'usdc');

    await walletService.withdraw(USER_1, wallet.id, '1', VALID_DEST);
    await walletService.withdraw(USER_1, wallet.id, '2', VALID_DEST);
    await walletService.withdraw(USER_1, wallet.id, '3', VALID_DEST);

    const result = await walletService.getWithdrawalHistory(wallet.id, 2, 0);
    expect(result.withdrawals.length).toBe(2);
    expect(result.total).toBe(3);

    const page2 = await walletService.getWithdrawalHistory(wallet.id, 2, 2);
    expect(page2.withdrawals.length).toBe(1);
  });

  // Test 5: Concurrent withdrawals don't overdraw
  it('should handle 20 concurrent withdrawals without overdraw', async () => {
    const wallet = await walletService.createWallet(USER_1);
    await walletService.fundWallet(wallet.id, 10, 'usdc'); // ~9.95 after fee

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        walletService.withdraw(USER_1, wallet.id, '1.000000', VALID_DEST),
      ),
    );

    const successes = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected').length;

    expect(successes).toBeLessThanOrEqual(9);
    expect(successes + failures).toBe(20);

    const final = await walletService.getWallet(wallet.id);
    expect(parseFloat(final!.balance)).toBeGreaterThanOrEqual(0);

    // Verify withdrawal records match successes
    const history = await walletService.getWithdrawalHistory(wallet.id, 100, 0);
    expect(history.total).toBe(successes);
  });

  // Test 6: markProcessing CAS — only one wins
  it('should allow only one processor to win markProcessing CAS', async () => {
    const wallet = await walletService.createWallet(USER_1);
    await walletService.fundWallet(wallet.id, 10, 'usdc');

    const result = await walletService.withdraw(USER_1, wallet.id, '1', VALID_DEST);

    // 10 concurrent markProcessing attempts
    const casResults = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        withdrawalRepo.markProcessing(result.withdrawalId),
      ),
    );

    const wins = casResults.filter(r => r.status === 'fulfilled' && r.value === true).length;
    expect(wins).toBe(1);
  });

  // Test 7: Full lifecycle — queued → processing → completed
  it('should transition through full withdrawal lifecycle', async () => {
    const wallet = await walletService.createWallet(USER_1);
    await walletService.fundWallet(wallet.id, 10, 'usdc');

    const result = await walletService.withdraw(USER_1, wallet.id, '1', VALID_DEST);

    // queued → processing
    const processed = await withdrawalRepo.markProcessing(result.withdrawalId);
    expect(processed).toBe(true);
    const w1 = await withdrawalRepo.findById(result.withdrawalId);
    expect(w1!.status).toBe('processing');

    // processing → completed
    const completed = await withdrawalRepo.markCompleted(result.withdrawalId, '0xabc123');
    expect(completed).toBe(true);
    const w2 = await withdrawalRepo.findById(result.withdrawalId);
    expect(w2!.status).toBe('completed');
    expect(w2!.txHash).toBe('0xabc123');

    // Cannot transition again
    const again = await withdrawalRepo.markCompleted(result.withdrawalId, '0xother');
    expect(again).toBe(false);
  });
});
```

- [ ] **Step 2: Run all integration tests**

Run: `cd /Users/drpraize/agntly && ./node_modules/.bin/vitest run --config vitest.integration.config.ts`
Expected: All tests pass (26 existing + 7 new = 33 total).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/withdrawals.test.ts
git commit -m "test: add withdrawal integration tests with concurrent overdraw prevention and CAS lifecycle"
```

---

## Summary

| Task | What it does | Files touched |
|------|-------------|---------------|
| 1 | WithdrawalRepository with CAS | `withdrawal-repository.ts` (new) |
| 2 | Transactional withdraw + auth in WalletService | `wallet-service.ts`, `server.ts` |
| 3 | EIP-55 validation + history endpoint | `wallets.ts` (rewrite) |
| 4 | USDC transfer handler in settlement-worker | `settlement-service.ts`, `server.ts` |
| 5 | Integration tests (7 cases) | `withdrawals.test.ts` (new) |

**Total: 5 tasks, ~8 files.**

**Critical correctness properties tested:**
- Atomic debit + record creation in single transaction (Test 1)
- Wallet ownership verification prevents unauthorized withdrawals (Test 2)
- 20 concurrent withdrawals on $10 wallet — no overdraw, record count matches successes (Test 5)
- markProcessing CAS — exactly 1 winner under 10 concurrent attempts (Test 6)
- Full lifecycle queued→processing→completed with txHash (Test 7)
