# Wallet Concurrency Fix + Saga Event Bus + Critical Path Integration Tests

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the wallet double-spend race condition with SELECT FOR UPDATE, wire up Redis Streams so services communicate via events (saga pattern), and prove correctness with a concurrent integration test suite.

**Architecture:** Replace all three in-memory service stores (wallet, escrow, task) with real PostgreSQL via Drizzle ORM, using atomic `UPDATE ... WHERE balance >= amount` guards on all balance operations to prevent overdraw. Services publish domain events to Redis Streams after state changes. An integration test suite spins up PG + Redis in Docker and runs the full task→escrow→wallet flow 100x concurrently to prove no money is lost.

**Balance semantics:** `balance` = available funds, `locked` = reserved funds. Total deposited = `balance + locked`. The `lockFunds` operation subtracts from `balance` and adds to `locked`. The WHERE guard is simply `balance >= amount` (NOT `balance - locked`, which would double-count).

**Snake/camelCase:** All repositories use Drizzle's type-safe query builder (`.select().from()`) for reads. Raw `db.execute(sql\`...\`)` is used only for UPDATE operations where we check `result.rows.length` — never for reading field values from returned rows, avoiding the snake_case/camelCase mismatch.

**Tech Stack:** Drizzle ORM, PostgreSQL 16, Redis 7 Streams, Vitest, Docker Compose, tsx

---

## File Structure

### Shared package changes
- **Modify:** `shared/src/types/index.ts` — Add new event types for saga
- **Modify:** `shared/src/redis/event-bus.ts` — Extend WebhookEvent union for saga events
- **Modify:** `shared/src/db/connection.ts` — Add raw pool access for transactions

### Wallet service changes
- **Create:** `services/wallet-service/src/repositories/wallet-repository.ts` — PostgreSQL wallet CRUD with FOR UPDATE
- **Modify:** `services/wallet-service/src/services/wallet-service.ts` — Use repository instead of in-memory Map
- **Modify:** `services/wallet-service/src/server.ts` — Initialize DB + EventBus

### Escrow engine changes
- **Create:** `services/escrow-engine/src/repositories/escrow-repository.ts` — PostgreSQL escrow CRUD
- **Modify:** `services/escrow-engine/src/services/escrow-service.ts` — Use repository, publish events
- **Modify:** `services/escrow-engine/src/server.ts` — Initialize DB + EventBus

### Task service changes
- **Create:** `services/task-service/src/repositories/task-repository.ts` — PostgreSQL task CRUD
- **Modify:** `services/task-service/src/services/task-service.ts` — Use repository, publish events
- **Modify:** `services/task-service/src/server.ts` — Initialize DB + EventBus

### Integration tests
- **Create:** `tests/integration/setup.ts` — Docker PG+Redis setup/teardown
- **Create:** `tests/integration/critical-path.test.ts` — Full saga flow test
- **Create:** `tests/integration/concurrency.test.ts` — 100x concurrent wallet lock test
- **Create:** `vitest.integration.config.ts` — Vitest config for integration tests
- **Modify:** `package.json` — Add `test:integration` script

---

## Task 1: Extend shared types for saga events

**Files:**
- Modify: `shared/src/types/index.ts`

- [ ] **Step 1: Add saga event types to WebhookEvent union**

Open `shared/src/types/index.ts` and replace the `WebhookEvent` type:

```typescript
export type WebhookEvent =
  | 'task.created'
  | 'task.escrowed'
  | 'task.dispatched'
  | 'task.completed'
  | 'task.failed'
  | 'task.disputed'
  | 'escrow.locked'
  | 'escrow.released'
  | 'escrow.refunded'
  | 'escrow.failed'
  | 'wallet.funded'
  | 'wallet.withdrawn'
  | 'wallet.locked'
  | 'wallet.unlocked'
  | 'agent.verified';
```

- [ ] **Step 2: Verify shared builds**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/shared build`
Expected: Successful compilation with no errors.

- [ ] **Step 3: Commit**

```bash
git add shared/src/types/index.ts
git commit -m "feat: extend WebhookEvent union with saga event types"
```

---

## Task 2: Add raw pool access to shared DB connection

The `SELECT ... FOR UPDATE` needs to run inside a transaction. Drizzle ORM supports transactions via the pool, but we need to expose the raw pool so services can use `db.transaction()`.

**Files:**
- Modify: `shared/src/db/connection.ts`

- [ ] **Step 1: Expose pool and add transaction helper**

Replace `shared/src/db/connection.ts` with:

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

export function createPool(connectionString?: string) {
  return new pg.Pool({
    connectionString: connectionString ?? process.env.DATABASE_URL ?? 'postgresql://agntly:agntly@localhost:5432/agntly',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

export function createDbConnection(connectionString?: string) {
  const pool = createPool(connectionString);
  return drizzle(pool);
}

export type DbConnection = ReturnType<typeof createDbConnection>;
export type DbPool = pg.Pool;
```

Key changes: max pool reduced from 20 to 10 (8 services × 10 = 80, too close to PG default 100). Added `createPool()` as a separate export. **`createDbConnection` return type is UNCHANGED** — it still returns a Drizzle instance, so existing callers don't break. Services that need the raw pool call `createPool()` separately.

- [ ] **Step 2: Search for all existing callers to verify no breakage**

Run: `cd /Users/drpraize/agntly && grep -r 'createDbConnection' services/ shared/ tests/ --include='*.ts' -l`
Expected: Lists files that import it. Verify none of them break with the unchanged return type.

- [ ] **Step 3: Update shared barrel export**

In `shared/src/index.ts`, the existing `export * from './db/connection.js'` already covers this — no change needed. Verify it still works:

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/shared build`
Expected: Successful compilation.

- [ ] **Step 3: Commit**

```bash
git add shared/src/db/connection.ts
git commit -m "feat: expose raw pool from db connection for transactions"
```

---

## Task 3: Create wallet repository with SELECT FOR UPDATE

This is the core concurrency fix. Every balance mutation acquires a row-level lock.

**Files:**
- Create: `services/wallet-service/src/repositories/wallet-repository.ts`

- [ ] **Step 1: Write the wallet repository**

Create `services/wallet-service/src/repositories/wallet-repository.ts`:

```typescript
import { eq, sql } from 'drizzle-orm';
import type { DbConnection } from '@agntly/shared';
import { wallets } from '../db/schema.js';

export interface WalletRow {
  readonly id: string;
  readonly ownerId: string;
  readonly agentId: string | null;
  readonly address: string;
  readonly balance: string;
  readonly locked: string;
  readonly chain: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class WalletRepository {
  constructor(private readonly db: DbConnection) {}

  async create(data: {
    ownerId: string;
    agentId?: string;
    address: string;
    chain?: string;
  }): Promise<WalletRow> {
    const [row] = await this.db
      .insert(wallets)
      .values({
        ownerId: data.ownerId,
        agentId: data.agentId ?? null,
        address: data.address,
        chain: data.chain ?? 'base-sepolia',
      })
      .returning();
    return row as WalletRow;
  }

  async findById(id: string): Promise<WalletRow | null> {
    const [row] = await this.db
      .select()
      .from(wallets)
      .where(eq(wallets.id, id))
      .limit(1);
    return (row as WalletRow) ?? null;
  }

  /**
   * Lock funds: atomically move from available (balance) to reserved (locked).
   * Balance semantics: balance = available, locked = reserved.
   * Guard: balance >= amount (NOT balance - locked, which double-counts).
   * Returns true if lock succeeded, false if insufficient funds.
   */
  async lockFunds(walletId: string, amount: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE wallets
      SET
        balance = balance - ${amount}::numeric,
        locked = locked + ${amount}::numeric,
        updated_at = NOW()
      WHERE id = ${walletId}::uuid
        AND balance >= ${amount}::numeric
      RETURNING id
    `);
    return (result.rows?.length ?? 0) > 0;
  }

  /**
   * Release locked funds to a destination wallet.
   * Uses a CTE with existence checks on BOTH wallets.
   * If either wallet is missing, neither UPDATE executes (no money destroyed).
   */
  async releaseFunds(
    fromWalletId: string,
    toWalletId: string,
    grossAmount: string,
    netAmount: string,
  ): Promise<boolean> {
    const result = await this.db.execute(sql`
      WITH source_check AS (
        SELECT id FROM wallets WHERE id = ${fromWalletId}::uuid AND locked >= ${grossAmount}::numeric
      ),
      dest_check AS (
        SELECT id FROM wallets WHERE id = ${toWalletId}::uuid
      ),
      deducted AS (
        UPDATE wallets
        SET
          locked = locked - ${grossAmount}::numeric,
          updated_at = NOW()
        WHERE id = ${fromWalletId}::uuid
          AND EXISTS (SELECT 1 FROM source_check)
          AND EXISTS (SELECT 1 FROM dest_check)
        RETURNING id
      ),
      credited AS (
        UPDATE wallets
        SET
          balance = balance + ${netAmount}::numeric,
          updated_at = NOW()
        WHERE id = ${toWalletId}::uuid
          AND EXISTS (SELECT 1 FROM deducted)
        RETURNING id
      )
      SELECT
        (SELECT count(*) FROM deducted) AS deducted_count,
        (SELECT count(*) FROM credited) AS credited_count
    `);
    const row = result.rows?.[0] as { deducted_count: string; credited_count: string } | undefined;
    return row?.deducted_count === '1' && row?.credited_count === '1';
  }

  /**
   * Refund locked funds back to available balance.
   */
  async refundFunds(walletId: string, amount: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE wallets
      SET
        balance = balance + ${amount}::numeric,
        locked = locked - ${amount}::numeric,
        updated_at = NOW()
      WHERE id = ${walletId}::uuid
        AND locked >= ${amount}::numeric
      RETURNING id
    `);
    return (result.rows?.length ?? 0) > 0;
  }

  /**
   * Credit wallet balance (for funding / deposits).
   */
  async creditBalance(walletId: string, amount: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE wallets
      SET
        balance = balance + ${amount}::numeric,
        updated_at = NOW()
      WHERE id = ${walletId}::uuid
      RETURNING id
    `);
    return (result.rows?.length ?? 0) > 0;
  }

  /**
   * Withdraw: atomically debit balance with guard.
   * Prevents the read-then-write race in the old withdraw method.
   */
  async debitBalance(walletId: string, amount: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE wallets
      SET
        balance = balance - ${amount}::numeric,
        updated_at = NOW()
      WHERE id = ${walletId}::uuid
        AND balance >= ${amount}::numeric
      RETURNING id
    `);
    return (result.rows?.length ?? 0) > 0;
  }
}
```

Key design decisions:
- `lockFunds` guard is `balance >= amount` (NOT `balance - locked` which would double-count since balance already excludes locked funds).
- `releaseFunds` verifies BOTH source and destination wallets exist before executing either UPDATE. If either is missing, zero rows update — no money destroyed.
- Added `debitBalance` for withdrawals with the same atomic guard pattern, fixing the old read-then-write race condition.
- All methods use raw `db.execute` only for UPDATE operations where we check row counts — never reading field values from returned rows (avoids snake_case/camelCase mismatch).

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/wallet-service build`
Expected: Successful compilation (or type errors if shared hasn't been built — run shared first).

- [ ] **Step 3: Commit**

```bash
git add services/wallet-service/src/repositories/wallet-repository.ts
git commit -m "feat: add wallet repository with atomic balance operations"
```

---

## Task 4: Rewrite WalletService to use repository + EventBus

**Files:**
- Modify: `services/wallet-service/src/services/wallet-service.ts`

- [ ] **Step 1: Rewrite wallet-service.ts**

Replace `services/wallet-service/src/services/wallet-service.ts` with:

```typescript
import { generateId } from '@agntly/shared';
import type { EventBus } from '@agntly/shared';
import type { WalletRepository, WalletRow } from '../repositories/wallet-repository.js';

export class WalletService {
  constructor(
    private readonly repo: WalletRepository,
    private readonly eventBus?: EventBus,
  ) {}

  async createWallet(ownerId: string, agentId?: string): Promise<WalletRow> {
    const address = `0x${Buffer.from(generateId('addr')).toString('hex').padEnd(40, '0').slice(0, 40)}`;
    const wallet = await this.repo.create({ ownerId, agentId, address });
    return wallet;
  }

  async getWallet(walletId: string): Promise<WalletRow | null> {
    return this.repo.findById(walletId);
  }

  async fundWallet(
    walletId: string,
    amountUsd: number,
    method: string,
  ): Promise<{ depositId: string; amountUsd: number; usdcAmount: string; status: string; etaSeconds: number }> {
    const wallet = await this.repo.findById(walletId);
    if (!wallet) throw new Error('Wallet not found');

    const feeRate = method === 'card' ? 0.015 : 0.005;
    const fee = amountUsd * feeRate;
    const usdcAmount = (amountUsd - fee).toFixed(6);

    const credited = await this.repo.creditBalance(walletId, usdcAmount);
    if (!credited) throw new Error('Failed to credit wallet');

    if (this.eventBus) {
      await this.eventBus.publish('wallet.funded', {
        walletId,
        amountUsd,
        usdcAmount,
        method,
      });
    }

    return {
      depositId: generateId('dep'),
      amountUsd,
      usdcAmount,
      status: 'confirmed',
      etaSeconds: method === 'card' ? 30 : 86400,
    };
  }

  async withdraw(
    walletId: string,
    amount: string,
    destination: string,
    instant?: boolean,
  ): Promise<{ withdrawalId: string; amount: string; destination: string; fee: string; status: string }> {
    const fee = instant ? (parseFloat(amount) * 0.005).toFixed(6) : '0.000000';

    // Atomic debit with balance guard — no read-then-write race condition
    const debited = await this.repo.debitBalance(walletId, amount);
    if (!debited) throw new Error('Insufficient available balance or wallet not found');

    if (this.eventBus) {
      await this.eventBus.publish('wallet.withdrawn', {
        walletId,
        amount,
        destination,
        fee,
      });
    }

    return {
      withdrawalId: generateId('wth'),
      amount,
      destination,
      fee,
      status: instant ? 'processing' : 'queued',
    };
  }

  async lockFunds(walletId: string, amount: string): Promise<boolean> {
    const locked = await this.repo.lockFunds(walletId, amount);
    if (locked && this.eventBus) {
      await this.eventBus.publish('wallet.locked', { walletId, amount });
    }
    return locked;
  }

  async releaseFunds(
    fromWalletId: string,
    toWalletId: string,
    grossAmount: string,
    netAmount: string,
  ): Promise<boolean> {
    const released = await this.repo.releaseFunds(fromWalletId, toWalletId, grossAmount, netAmount);
    if (released && this.eventBus) {
      await this.eventBus.publish('wallet.unlocked', {
        fromWalletId,
        toWalletId,
        grossAmount,
        netAmount,
      });
    }
    return released;
  }

  async refundFunds(walletId: string, amount: string): Promise<boolean> {
    return this.repo.refundFunds(walletId, amount);
  }
}
```

Key changes from old version:
- Constructor takes `WalletRepository` + optional `EventBus` (dependency injection)
- `lockFunds` now delegates to atomic DB operation — no race condition possible
- `releaseFunds` signature changed: takes from/to wallets and gross/net amounts (the escrow fee split)
- Every mutation publishes an event to Redis Streams
- No more in-memory Map

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/wallet-service build`
Expected: Compilation succeeds (routes will have type errors until updated — that's Task 7).

- [ ] **Step 3: Commit**

```bash
git add services/wallet-service/src/services/wallet-service.ts
git commit -m "feat: rewrite WalletService with repository pattern and event publishing"
```

---

## Task 5: Create escrow repository

**Files:**
- Create: `services/escrow-engine/src/repositories/escrow-repository.ts`

- [ ] **Step 1: Write the escrow repository**

Create `services/escrow-engine/src/repositories/escrow-repository.ts`:

```typescript
import { eq, sql } from 'drizzle-orm';
import type { DbConnection } from '@agntly/shared';
import { escrows, escrowAuditLog } from '../db/schema.js';

export interface EscrowRow {
  readonly id: string;
  readonly taskId: string;
  readonly fromWalletId: string;
  readonly toWalletId: string;
  readonly amount: string;
  readonly fee: string;
  readonly state: 'locked' | 'released' | 'refunded' | 'disputed';
  readonly txHash: string | null;
  readonly resultHash: string | null;
  readonly deadline: Date;
  readonly createdAt: Date;
  readonly settledAt: Date | null;
}

export class EscrowRepository {
  constructor(private readonly db: DbConnection) {}

  async create(data: {
    taskId: string;
    fromWalletId: string;
    toWalletId: string;
    amount: string;
    fee: string;
    deadline: Date;
    txHash?: string;
  }): Promise<EscrowRow> {
    const [row] = await this.db
      .insert(escrows)
      .values({
        taskId: data.taskId,
        fromWalletId: data.fromWalletId,
        toWalletId: data.toWalletId,
        amount: data.amount,
        fee: data.fee,
        deadline: data.deadline,
        txHash: data.txHash ?? null,
      })
      .returning();
    return row as unknown as EscrowRow;
  }

  async findById(id: string): Promise<EscrowRow | null> {
    const [row] = await this.db
      .select()
      .from(escrows)
      .where(eq(escrows.id, id))
      .limit(1);
    return (row as unknown as EscrowRow) ?? null;
  }

  async findByTaskId(taskId: string): Promise<EscrowRow | null> {
    const [row] = await this.db
      .select()
      .from(escrows)
      .where(eq(escrows.taskId, taskId))
      .limit(1);
    return (row as unknown as EscrowRow) ?? null;
  }

  /**
   * Transition state atomically. Only succeeds if current state matches `fromState`.
   * Uses UPDATE for the write, then Drizzle SELECT for the read (correct camelCase mapping).
   */
  async transition(
    escrowId: string,
    fromState: 'locked' | 'released' | 'refunded' | 'disputed',
    toState: 'locked' | 'released' | 'refunded' | 'disputed',
    extra?: { resultHash?: string; disputeReason?: string },
  ): Promise<EscrowRow | null> {
    const settledAt = (toState === 'released' || toState === 'refunded') ? new Date() : undefined;

    const result = await this.db.execute(sql`
      UPDATE escrows
      SET
        state = ${toState}::escrow_state,
        result_hash = COALESCE(${extra?.resultHash ?? null}, result_hash),
        dispute_reason = COALESCE(${extra?.disputeReason ?? null}, dispute_reason),
        settled_at = COALESCE(${settledAt?.toISOString() ?? null}::timestamptz, settled_at)
      WHERE id = ${escrowId}::uuid
        AND state = ${fromState}::escrow_state
      RETURNING id
    `);

    if (!result.rows?.length) return null;

    // Use Drizzle's typed SELECT to get the row with correct camelCase mapping
    return this.findById(escrowId);
  }

  async addAuditEntry(data: {
    escrowId: string;
    action: string;
    actor: string;
    details?: string;
  }): Promise<void> {
    await this.db.insert(escrowAuditLog).values({
      escrowId: data.escrowId,
      action: data.action,
      actor: data.actor,
      details: data.details ?? null,
    });
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/escrow-engine build`

- [ ] **Step 3: Commit**

```bash
git add services/escrow-engine/src/repositories/escrow-repository.ts
git commit -m "feat: add escrow repository with atomic state transitions"
```

---

## Task 6: Rewrite EscrowService with repository + EventBus

**Files:**
- Modify: `services/escrow-engine/src/services/escrow-service.ts`

- [ ] **Step 1: Rewrite escrow-service.ts**

Replace `services/escrow-engine/src/services/escrow-service.ts` with:

```typescript
import { generateId, calculateFee } from '@agntly/shared';
import type { EventBus } from '@agntly/shared';
import type { EscrowRepository, EscrowRow } from '../repositories/escrow-repository.js';

export class EscrowService {
  constructor(
    private readonly repo: EscrowRepository,
    private readonly eventBus?: EventBus,
  ) {}

  async lockEscrow(params: {
    taskId: string;
    fromWalletId: string;
    toWalletId: string;
    amount: string;
    deadline: Date;
  }): Promise<EscrowRow> {
    const { fee } = calculateFee(params.amount);
    const txHash = `0x${Buffer.from(generateId('tx')).toString('hex').padEnd(64, '0')}`;

    const escrow = await this.repo.create({
      taskId: params.taskId,
      fromWalletId: params.fromWalletId,
      toWalletId: params.toWalletId,
      amount: params.amount,
      fee,
      deadline: params.deadline,
      txHash,
    });

    await this.repo.addAuditEntry({
      escrowId: escrow.id,
      action: 'locked',
      actor: 'system',
      details: `Locked ${params.amount} USDC for task ${params.taskId}`,
    });

    if (this.eventBus) {
      await this.eventBus.publish('escrow.locked', {
        escrowId: escrow.id,
        taskId: params.taskId,
        fromWalletId: params.fromWalletId,
        toWalletId: params.toWalletId,
        amount: params.amount,
        fee,
      });
    }

    return escrow;
  }

  async releaseEscrow(escrowId: string, resultHash?: string): Promise<EscrowRow> {
    const released = await this.repo.transition(escrowId, 'locked', 'released', { resultHash });
    if (!released) {
      const existing = await this.repo.findById(escrowId);
      if (!existing) throw new Error('Escrow not found');
      throw new Error(`Cannot release escrow in state: ${existing.state}`);
    }

    await this.repo.addAuditEntry({
      escrowId,
      action: 'released',
      actor: 'system',
      details: resultHash ? `Released with result hash ${resultHash}` : 'Released',
    });

    if (this.eventBus) {
      await this.eventBus.publish('escrow.released', {
        escrowId,
        taskId: released.taskId,
        fromWalletId: released.fromWalletId,
        toWalletId: released.toWalletId,
        amount: released.amount,
        fee: released.fee,
      });
    }

    return released;
  }

  async refundEscrow(escrowId: string): Promise<EscrowRow> {
    const refunded = await this.repo.transition(escrowId, 'locked', 'refunded');
    if (!refunded) {
      const existing = await this.repo.findById(escrowId);
      if (!existing) throw new Error('Escrow not found');
      throw new Error(`Cannot refund escrow in state: ${existing.state}`);
    }

    await this.repo.addAuditEntry({
      escrowId,
      action: 'refunded',
      actor: 'system',
    });

    if (this.eventBus) {
      await this.eventBus.publish('escrow.refunded', {
        escrowId,
        taskId: refunded.taskId,
        walletId: refunded.fromWalletId,
        amount: refunded.amount,
      });
    }

    return refunded;
  }

  async disputeEscrow(escrowId: string, reason: string): Promise<EscrowRow> {
    const disputed = await this.repo.transition(escrowId, 'locked', 'disputed', { disputeReason: reason });
    if (!disputed) {
      const existing = await this.repo.findById(escrowId);
      if (!existing) throw new Error('Escrow not found');
      throw new Error(`Cannot dispute escrow in state: ${existing.state}`);
    }

    await this.repo.addAuditEntry({
      escrowId,
      action: 'disputed',
      actor: 'system',
      details: reason,
    });

    return disputed;
  }

  async getEscrow(escrowId: string): Promise<EscrowRow | null> {
    return this.repo.findById(escrowId);
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/escrow-engine build`

- [ ] **Step 3: Commit**

```bash
git add services/escrow-engine/src/services/escrow-service.ts
git commit -m "feat: rewrite EscrowService with repository and saga events"
```

---

## Task 7: Create task repository and rewrite TaskService

**Files:**
- Create: `services/task-service/src/repositories/task-repository.ts`
- Modify: `services/task-service/src/services/task-service.ts`

- [ ] **Step 1: Write the task repository**

Create `services/task-service/src/repositories/task-repository.ts`:

```typescript
import { eq, sql } from 'drizzle-orm';
import type { DbConnection } from '@agntly/shared';
import { tasks, taskAuditLog } from '../db/schema.js';

export interface TaskRow {
  readonly id: string;
  readonly orchestratorId: string;
  readonly agentId: string;
  readonly payload: Record<string, unknown>;
  readonly result: Record<string, unknown> | null;
  readonly status: 'pending' | 'escrowed' | 'dispatched' | 'complete' | 'failed' | 'disputed';
  readonly amount: string;
  readonly fee: string;
  readonly escrowTx: string | null;
  readonly settleTx: string | null;
  readonly deadline: Date;
  readonly latencyMs: number | null;
  readonly errorMessage: string | null;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
}

export class TaskRepository {
  constructor(private readonly db: DbConnection) {}

  async create(data: {
    id: string;
    orchestratorId: string;
    agentId: string;
    payload: Record<string, unknown>;
    amount: string;
    fee: string;
    deadline: Date;
    escrowTx?: string;
  }): Promise<TaskRow> {
    const [row] = await this.db
      .insert(tasks)
      .values({
        id: data.id,
        orchestratorId: data.orchestratorId,
        agentId: data.agentId,
        payload: data.payload,
        amount: data.amount,
        fee: data.fee,
        deadline: data.deadline,
        escrowTx: data.escrowTx ?? null,
        status: 'pending',
      })
      .returning();
    return row as unknown as TaskRow;
  }

  async findById(id: string): Promise<TaskRow | null> {
    const [row] = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);
    return (row as unknown as TaskRow) ?? null;
  }

  async transition(
    taskId: string,
    fromStates: readonly string[],
    toState: string,
    extra?: {
      result?: Record<string, unknown>;
      latencyMs?: number;
      settleTx?: string;
      escrowTx?: string;
      errorMessage?: string;
    },
  ): Promise<TaskRow | null> {
    // Validate states against enum to prevent SQL injection (no sql.raw)
    const validStates = ['pending', 'escrowed', 'dispatched', 'complete', 'failed', 'disputed'];
    for (const s of fromStates) {
      if (!validStates.includes(s)) throw new Error(`Invalid task state: ${s}`);
    }

    const completedAt = (toState === 'complete' || toState === 'failed') ? new Date() : undefined;

    // Use a simple single-state check if only one fromState, otherwise chain OR conditions
    // This avoids sql.raw entirely
    const stateCondition = fromStates.length === 1
      ? sql`status = ${fromStates[0]}::task_status`
      : sql`status IN (${sql.join(fromStates.map(s => sql`${s}::task_status`), sql`, `)})`;

    const result = await this.db.execute(sql`
      UPDATE tasks
      SET
        status = ${toState}::task_status,
        result = COALESCE(${extra?.result ? JSON.stringify(extra.result) : null}::jsonb, result),
        latency_ms = COALESCE(${extra?.latencyMs ?? null}::integer, latency_ms),
        settle_tx = COALESCE(${extra?.settleTx ?? null}, settle_tx),
        escrow_tx = COALESCE(${extra?.escrowTx ?? null}, escrow_tx),
        error_message = COALESCE(${extra?.errorMessage ?? null}, error_message),
        completed_at = COALESCE(${completedAt?.toISOString() ?? null}::timestamptz, completed_at)
      WHERE id = ${taskId}
        AND ${stateCondition}
      RETURNING id
    `);

    if (!result.rows?.length) return null;

    // Use Drizzle's typed SELECT to get the row with correct camelCase mapping
    return this.findById(taskId);
  }

  async addAuditEntry(data: {
    taskId: string;
    status: string;
    details?: string;
  }): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO task_audit_log (id, task_id, status, details, created_at)
      VALUES (gen_random_uuid(), ${data.taskId}, ${data.status}::task_status, ${data.details ?? null}, NOW())
    `);
  }
}
```

- [ ] **Step 2: Rewrite task-service.ts**

Replace `services/task-service/src/services/task-service.ts` with:

```typescript
import { generateId, calculateFee, DEFAULT_TASK_TIMEOUT_MS } from '@agntly/shared';
import type { EventBus } from '@agntly/shared';
import type { TaskRepository, TaskRow } from '../repositories/task-repository.js';

export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly eventBus?: EventBus,
  ) {}

  async createTask(
    orchestratorId: string,
    agentId: string,
    payload: Record<string, unknown>,
    budget: string,
    timeoutMs?: number,
  ): Promise<TaskRow> {
    const id = generateId('tsk');
    const { fee } = calculateFee(budget);
    const timeout = timeoutMs ?? DEFAULT_TASK_TIMEOUT_MS;
    const deadline = new Date(Date.now() + timeout);

    const task = await this.repo.create({
      id,
      orchestratorId,
      agentId,
      payload,
      amount: budget,
      fee,
      deadline,
    });

    await this.repo.addAuditEntry({
      taskId: id,
      status: 'pending',
      details: `Task created with budget ${budget} USDC`,
    });

    if (this.eventBus) {
      await this.eventBus.publish('task.created', {
        taskId: id,
        orchestratorId,
        agentId,
        amount: budget,
        fee,
      });
    }

    return task;
  }

  async getTask(taskId: string): Promise<TaskRow | null> {
    return this.repo.findById(taskId);
  }

  async markEscrowed(taskId: string, escrowTx: string): Promise<TaskRow> {
    const updated = await this.repo.transition(taskId, ['pending'], 'escrowed', { escrowTx });
    if (!updated) throw new Error('Task not found or not in pending state');

    await this.repo.addAuditEntry({ taskId, status: 'escrowed' });

    if (this.eventBus) {
      await this.eventBus.publish('task.escrowed', { taskId, escrowTx });
    }

    return updated;
  }

  async completeTask(taskId: string, result: Record<string, unknown>): Promise<TaskRow> {
    const task = await this.repo.findById(taskId);
    if (!task) throw new Error('Task not found');

    const latencyMs = Date.now() - task.createdAt.getTime();
    const settleTx = `0x${Buffer.from(taskId).toString('hex').padEnd(64, 'f')}`;

    const completed = await this.repo.transition(
      taskId,
      ['escrowed', 'dispatched'],
      'complete',
      { result, latencyMs, settleTx },
    );
    if (!completed) throw new Error(`Cannot complete task in state: ${task.status}`);

    await this.repo.addAuditEntry({ taskId, status: 'complete' });

    if (this.eventBus) {
      await this.eventBus.publish('task.completed', {
        taskId,
        agentId: completed.agentId,
        amount: completed.amount,
        fee: completed.fee,
        latencyMs,
      });
    }

    return completed;
  }

  async disputeTask(taskId: string, reason: string): Promise<TaskRow> {
    const disputed = await this.repo.transition(taskId, ['escrowed', 'dispatched'], 'disputed');
    if (!disputed) throw new Error('Task not found or cannot be disputed');

    await this.repo.addAuditEntry({ taskId, status: 'disputed', details: reason });

    if (this.eventBus) {
      await this.eventBus.publish('task.disputed', { taskId, reason });
    }

    return disputed;
  }
}
```

- [ ] **Step 3: Verify both compile**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/task-service build`

- [ ] **Step 4: Commit**

```bash
git add services/task-service/src/repositories/task-repository.ts services/task-service/src/services/task-service.ts
git commit -m "feat: rewrite TaskService with repository, audit log, and saga events"
```

---

## Task 8: Update service server.ts files to initialize DB + EventBus

**Files:**
- Modify: `services/wallet-service/src/server.ts`
- Modify: `services/escrow-engine/src/server.ts`
- Modify: `services/task-service/src/server.ts`

- [ ] **Step 1: Update wallet-service server.ts**

Replace `services/wallet-service/src/server.ts` with:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { SERVICE_PORTS, createDbConnection, EventBus } from '@agntly/shared';
import { healthRoutes } from './routes/health.js';
import { walletRoutes } from './routes/wallets.js';
import { WalletRepository } from './repositories/wallet-repository.js';
import { WalletService } from './services/wallet-service.js';

const { db } = createDbConnection();
const eventBus = new EventBus('wallet-service');
const walletRepo = new WalletRepository(db);
const walletService = new WalletService(walletRepo, eventBus);

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

// Make walletService accessible to routes
app.decorate('walletService', walletService);

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(walletRoutes, { prefix: '/v1/wallets' });

const port = SERVICE_PORTS.wallet;
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`wallet-service running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
```

- [ ] **Step 2: Update escrow-engine server.ts**

Replace `services/escrow-engine/src/server.ts` with:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { SERVICE_PORTS, createDbConnection, EventBus } from '@agntly/shared';
import { healthRoutes } from './routes/health.js';
import { escrowRoutes } from './routes/escrow.js';
import { EscrowRepository } from './repositories/escrow-repository.js';
import { EscrowService } from './services/escrow-service.js';

const { db } = createDbConnection();
const eventBus = new EventBus('escrow-engine');
const escrowRepo = new EscrowRepository(db);
const escrowService = new EscrowService(escrowRepo, eventBus);

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

app.decorate('escrowService', escrowService);

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(escrowRoutes, { prefix: '/v1/escrow' });

const port = SERVICE_PORTS.escrow;
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`escrow-engine running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
```

- [ ] **Step 3: Update task-service server.ts**

Replace `services/task-service/src/server.ts` with:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { SERVICE_PORTS, createDbConnection, EventBus } from '@agntly/shared';
import { healthRoutes } from './routes/health.js';
import { taskRoutes } from './routes/tasks.js';
import { TaskRepository } from './repositories/task-repository.js';
import { TaskService } from './services/task-service.js';

const { db } = createDbConnection();
const eventBus = new EventBus('task-service');
const taskRepo = new TaskRepository(db);
const taskService = new TaskService(taskRepo, eventBus);

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

app.decorate('taskService', taskService);

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(taskRoutes, { prefix: '/v1/tasks' });

const port = SERVICE_PORTS.task;
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`task-service running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
```

- [ ] **Step 4: Verify all three compile**

Run: `cd /Users/drpraize/agntly && pnpm build`
Expected: All services compile. Route files may have type errors referencing old service signatures — those are addressed in Task 9.

- [ ] **Step 5: Commit**

```bash
git add services/wallet-service/src/server.ts services/escrow-engine/src/server.ts services/task-service/src/server.ts
git commit -m "feat: initialize DB and EventBus in service entrypoints"
```

---

## Task 9: Fix route handlers for new service signatures

The route files in each service instantiate their own service internally. They need to be updated to accept the service via the Fastify decorator.

**Files:**
- Modify: `services/wallet-service/src/routes/wallets.ts`
- Modify: `services/escrow-engine/src/routes/escrow.ts`
- Modify: `services/task-service/src/routes/tasks.ts`

- [ ] **Step 1: Read current route files to understand the patterns**

Read all three route files to understand current handler code. Each one creates its own service instance (`new WalletService()`) internally. We need to change them to pull the service from the Fastify instance instead.

The core pattern change for every route file is:
1. Remove `import { XxxService } from '../services/xxx-service.js'`
2. Remove `const service = new XxxService()`
3. Access service via `request.server.walletService` (or equivalent)

Since the exact changes depend on each file's structure, read each file, apply the pattern, and ensure all handler calls match the new service method signatures.

- [ ] **Step 2: Update each route file, fixing method signatures**

For wallet routes: `lockFunds` and `releaseFunds` signatures changed. `withdraw` no longer does its own balance check.
For escrow routes: `lockEscrow` now requires `deadline` param. **Add `deadline` (ISO 8601 string) to the `lockSchema` Zod object** — parse it with `z.string().datetime()` and convert to `new Date()` before passing to the service. This is a breaking change that must be fixed or the `deadline NOT NULL` constraint will reject all inserts.
For task routes: `createTask` now returns `TaskRow` (slightly different shape). New `markEscrowed` method is available.

- [ ] **Step 3: Verify full build passes**

Run: `cd /Users/drpraize/agntly && pnpm build`
Expected: Clean compilation across all services.

- [ ] **Step 4: Commit**

```bash
git add services/wallet-service/src/routes/wallets.ts services/escrow-engine/src/routes/escrow.ts services/task-service/src/routes/tasks.ts
git commit -m "fix: update route handlers for new service signatures"
```

---

## Task 10: Set up integration test infrastructure

**Files:**
- Create: `tests/integration/setup.ts`
- Create: `vitest.integration.config.ts`
- Modify: `package.json` (root)

- [ ] **Step 1: Create vitest integration config**

Create `vitest.integration.config.ts` at root:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
```

Single-fork because integration tests share a database and must not run in parallel workers.

- [ ] **Step 2: Create test setup with Docker PG + Redis**

Create `tests/integration/setup.ts`:

```typescript
import pg from 'pg';
import IORedis from 'ioredis';
import { drizzle } from 'drizzle-orm/node-postgres';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://agntly:agntly@localhost:5432/agntly_test';
const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/1';

let pool: pg.Pool;
let redis: InstanceType<typeof IORedis>;

export async function setupTestDb() {
  // Connect to default db to create test db if needed
  const adminPool = new pg.Pool({
    connectionString: 'postgresql://agntly:agntly@localhost:5432/agntly',
  });

  try {
    await adminPool.query('CREATE DATABASE agntly_test');
  } catch (err: unknown) {
    // Only swallow "database already exists" (PG error code 42P04)
    if ((err as { code?: string }).code !== '42P04') throw err;
  }
  await adminPool.end();

  // Connect to test db
  pool = new pg.Pool({ connectionString: TEST_DB_URL, max: 20 });

  // Run migration
  const migrationSql = readFileSync(resolve(process.cwd(), 'scripts/migrate.sql'), 'utf-8');
  await pool.query(migrationSql);

  // Setup Redis
  redis = new IORedis(TEST_REDIS_URL);

  const db = drizzle(pool);
  return { db, pool, redis };
}

export async function cleanTestDb() {
  if (!pool) return;
  // Truncate all tables in reverse dependency order
  await pool.query(`
    TRUNCATE TABLE
      webhook_deliveries,
      webhook_subscriptions,
      task_audit_log,
      escrow_audit_log,
      agent_reviews,
      invoices,
      subscriptions,
      payments,
      deposits,
      withdrawals,
      escrows,
      tasks,
      api_keys,
      refresh_tokens,
      agents,
      wallets,
      users
    CASCADE
  `);
}

export async function teardownTestDb() {
  if (redis) {
    await redis.flushdb();
    await redis.quit();
  }
  if (pool) {
    await pool.end();
  }
}

export { pool, redis, TEST_DB_URL, TEST_REDIS_URL };
```

- [ ] **Step 3: Add test:integration script to root package.json**

Add to the `"scripts"` section in root `package.json`:

```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

- [ ] **Step 4: Install vitest at root if not present**

Run: `cd /Users/drpraize/agntly && pnpm add -D vitest -w`

- [ ] **Step 5: Verify Docker services are running**

Run: `cd /Users/drpraize/agntly && docker compose up -d postgres redis`
Expected: Both containers start and become healthy.

- [ ] **Step 6: Commit**

```bash
git add tests/integration/setup.ts vitest.integration.config.ts package.json pnpm-lock.yaml
git commit -m "feat: add integration test infrastructure with PG + Redis setup"
```

---

## Task 11: Write the critical path integration test

This is the most important test in the entire codebase. It proves the money path works end-to-end.

**Files:**
- Create: `tests/integration/critical-path.test.ts`

- [ ] **Step 1: Write the critical path test**

Create `tests/integration/critical-path.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, cleanTestDb, teardownTestDb } from './setup.js';
import { WalletRepository } from '../../services/wallet-service/src/repositories/wallet-repository.js';
import { EscrowRepository } from '../../services/escrow-engine/src/repositories/escrow-repository.js';
import { TaskRepository } from '../../services/task-service/src/repositories/task-repository.js';
import { WalletService } from '../../services/wallet-service/src/services/wallet-service.js';
import { EscrowService } from '../../services/escrow-engine/src/services/escrow-service.js';
import { TaskService } from '../../services/task-service/src/services/task-service.js';
import type { DbConnection } from '@agntly/shared';

let db: DbConnection;
let walletService: WalletService;
let escrowService: EscrowService;
let taskService: TaskService;

describe('Critical Path: Task → Escrow → Wallet → Settlement', () => {
  beforeAll(async () => {
    const setup = await setupTestDb();
    db = setup.db;

    const walletRepo = new WalletRepository(db);
    const escrowRepo = new EscrowRepository(db);
    const taskRepo = new TaskRepository(db);

    walletService = new WalletService(walletRepo);
    escrowService = new EscrowService(escrowRepo);
    taskService = new TaskService(taskRepo);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  it('should complete a full task lifecycle with correct balances', async () => {
    // 1. Create orchestrator wallet and fund it
    const orchWallet = await walletService.createWallet('orch-user-1');
    await walletService.fundWallet(orchWallet.id, 100, 'usdc');
    const fundedOrch = await walletService.getWallet(orchWallet.id);
    expect(parseFloat(fundedOrch!.balance)).toBe(99.5); // 0.5% ach fee

    // 2. Create agent wallet
    const agentWallet = await walletService.createWallet('agent-user-1', 'agent-search-v1');
    expect(parseFloat(agentWallet.balance)).toBe(0);

    // 3. Create task
    const taskAmount = '1.000000';
    const task = await taskService.createTask('orch-user-1', 'agent-search-v1', { query: 'test' }, taskAmount);
    expect(task.status).toBe('pending');

    // 4. Lock funds in orchestrator wallet
    const locked = await walletService.lockFunds(orchWallet.id, taskAmount);
    expect(locked).toBe(true);

    const orchAfterLock = await walletService.getWallet(orchWallet.id);
    expect(parseFloat(orchAfterLock!.balance)).toBeCloseTo(98.5, 1); // 99.5 - 1.0
    expect(parseFloat(orchAfterLock!.locked)).toBe(1.0);

    // 5. Create escrow
    const escrow = await escrowService.lockEscrow({
      taskId: task.id,
      fromWalletId: orchWallet.id,
      toWalletId: agentWallet.id,
      amount: taskAmount,
      deadline: new Date(Date.now() + 30_000),
    });
    expect(escrow.state).toBe('locked');

    // 6. Mark task as escrowed
    const escrowed = await taskService.markEscrowed(task.id, escrow.txHash!);
    expect(escrowed.status).toBe('escrowed');

    // 7. Complete the task
    const completed = await taskService.completeTask(task.id, { answer: 'test result' });
    expect(completed.status).toBe('complete');

    // 8. Release escrow
    const released = await escrowService.releaseEscrow(escrow.id);
    expect(released.state).toBe('released');

    // 9. Transfer funds: release from orch locked → agent balance (minus 3% fee)
    const { net } = await import('@agntly/shared').then(m => m.calculateFee(taskAmount));
    const transferred = await walletService.releaseFunds(
      orchWallet.id,
      agentWallet.id,
      taskAmount,
      net,
    );
    expect(transferred).toBe(true);

    // 10. Verify final balances
    const finalOrch = await walletService.getWallet(orchWallet.id);
    const finalAgent = await walletService.getWallet(agentWallet.id);

    // Orchestrator: started 99.5, locked 1.0, released 1.0 → balance 98.5, locked 0
    expect(parseFloat(finalOrch!.balance)).toBeCloseTo(98.5, 1);
    expect(parseFloat(finalOrch!.locked)).toBe(0);

    // Agent: started 0, received net (1.0 - 3% = 0.97) → balance 0.97
    expect(parseFloat(finalAgent!.balance)).toBeCloseTo(0.97, 2);
  });

  it('should refund on timeout correctly', async () => {
    const orchWallet = await walletService.createWallet('orch-user-2');
    await walletService.fundWallet(orchWallet.id, 10, 'usdc');
    const agentWallet = await walletService.createWallet('agent-user-2');

    const task = await taskService.createTask('orch-user-2', 'agent-2', { q: 'test' }, '1.000000');
    await walletService.lockFunds(orchWallet.id, '1.000000');

    const escrow = await escrowService.lockEscrow({
      taskId: task.id,
      fromWalletId: orchWallet.id,
      toWalletId: agentWallet.id,
      amount: '1.000000',
      deadline: new Date(Date.now() + 30_000),
    });

    // Simulate timeout → refund
    const refunded = await escrowService.refundEscrow(escrow.id);
    expect(refunded.state).toBe('refunded');

    // Return locked funds to available balance
    const unlocked = await walletService.refundFunds(orchWallet.id, '1.000000');
    expect(unlocked).toBe(true);

    const finalOrch = await walletService.getWallet(orchWallet.id);
    expect(parseFloat(finalOrch!.balance)).toBeCloseTo(9.95, 1); // original 9.95 (after 0.5% fee)
    expect(parseFloat(finalOrch!.locked)).toBe(0);
  });

  it('should prevent double-release on same escrow', async () => {
    const orchWallet = await walletService.createWallet('orch-user-3');
    await walletService.fundWallet(orchWallet.id, 10, 'usdc');
    const agentWallet = await walletService.createWallet('agent-user-3');

    const task = await taskService.createTask('orch-user-3', 'agent-3', { q: 'test' }, '1.000000');
    await walletService.lockFunds(orchWallet.id, '1.000000');

    const escrow = await escrowService.lockEscrow({
      taskId: task.id,
      fromWalletId: orchWallet.id,
      toWalletId: agentWallet.id,
      amount: '1.000000',
      deadline: new Date(Date.now() + 30_000),
    });

    // First release succeeds
    await escrowService.releaseEscrow(escrow.id);

    // Second release should throw
    await expect(escrowService.releaseEscrow(escrow.id))
      .rejects.toThrow('Cannot release escrow in state: released');
  });

  it('should reject lock when insufficient funds', async () => {
    const wallet = await walletService.createWallet('poor-user');
    await walletService.fundWallet(wallet.id, 1, 'usdc'); // 0.995 USDC after fee

    const locked = await walletService.lockFunds(wallet.id, '5.000000');
    expect(locked).toBe(false);

    // Balance unchanged
    const w = await walletService.getWallet(wallet.id);
    expect(parseFloat(w!.locked)).toBe(0);
  });

  it('should fail releaseFunds when destination wallet does not exist', async () => {
    const orchWallet = await walletService.createWallet('release-test-user');
    await walletService.fundWallet(orchWallet.id, 10, 'usdc');
    await walletService.lockFunds(orchWallet.id, '1.000000');

    const beforeRelease = await walletService.getWallet(orchWallet.id);

    // Release to non-existent wallet should return false and NOT modify source
    const released = await walletService.releaseFunds(
      orchWallet.id,
      'non-existent-wallet-id',
      '1.000000',
      '0.970000',
    );
    expect(released).toBe(false);

    // Source wallet locked should be unchanged (no money destroyed)
    const afterRelease = await walletService.getWallet(orchWallet.id);
    expect(afterRelease!.locked).toBe(beforeRelease!.locked);
    expect(afterRelease!.balance).toBe(beforeRelease!.balance);
  });
});
```

- [ ] **Step 2: Run the test to verify it works**

Run: `cd /Users/drpraize/agntly && pnpm test:integration`
Expected: All 4 tests pass. If Docker PG/Redis not running, start them first with `docker compose up -d postgres redis`.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/critical-path.test.ts
git commit -m "test: add critical path integration tests for task-escrow-wallet flow"
```

---

## Task 12: Write the concurrency stress test

This is the test that proves the wallet can't be double-spent.

**Files:**
- Create: `tests/integration/concurrency.test.ts`

- [ ] **Step 1: Write the concurrency test**

Create `tests/integration/concurrency.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, cleanTestDb, teardownTestDb } from './setup.js';
import { WalletRepository } from '../../services/wallet-service/src/repositories/wallet-repository.js';
import { WalletService } from '../../services/wallet-service/src/services/wallet-service.js';
import type { DbConnection } from '@agntly/shared';

let db: DbConnection;
let walletService: WalletService;

describe('Wallet Concurrency: 100x Concurrent Lock Attempts', () => {
  beforeAll(async () => {
    const setup = await setupTestDb();
    db = setup.db;
    const walletRepo = new WalletRepository(db);
    walletService = new WalletService(walletRepo);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  it('should never overdraw: 100 concurrent locks of $1 on a $50 wallet', async () => {
    // Create wallet with exactly $50
    const wallet = await walletService.createWallet('concurrency-test-user');
    await walletService.fundWallet(wallet.id, 50, 'usdc'); // 49.75 USDC after 0.5% fee

    const funded = await walletService.getWallet(wallet.id);
    const startBalance = parseFloat(funded!.balance);

    // Fire 100 concurrent lock attempts of $1 each
    const lockAmount = '1.000000';
    const concurrency = 100;

    const results = await Promise.allSettled(
      Array.from({ length: concurrency }, () =>
        walletService.lockFunds(wallet.id, lockAmount),
      ),
    );

    const successes = results.filter(
      (r) => r.status === 'fulfilled' && r.value === true,
    ).length;
    const failures = results.filter(
      (r) => r.status === 'fulfilled' && r.value === false,
    ).length;
    const errors = results.filter((r) => r.status === 'rejected').length;

    // Exactly floor(startBalance) locks should succeed
    // startBalance is ~49.75, so 49 locks should succeed
    const expectedSuccesses = Math.floor(startBalance);

    expect(successes).toBe(expectedSuccesses);
    expect(failures).toBe(concurrency - expectedSuccesses);
    expect(errors).toBe(0);

    // Verify final wallet state: no overdraw
    // Balance semantics: balance = available, locked = reserved
    // Total deposited = balance + locked (conservation of money)
    const final = await walletService.getWallet(wallet.id);
    const finalBalance = parseFloat(final!.balance);
    const finalLocked = parseFloat(final!.locked);

    // Balance (available) should be startBalance - successes
    expect(finalBalance).toBeCloseTo(startBalance - successes, 4);
    // Locked should be exactly successes * 1.0
    expect(finalLocked).toBeCloseTo(successes, 4);
    // Conservation: balance + locked == startBalance (no money created/destroyed)
    expect(finalBalance + finalLocked).toBeCloseTo(startBalance, 4);
    // Available (balance) should be >= 0 (NEVER negative)
    expect(finalBalance).toBeGreaterThanOrEqual(-0.0001);

    console.log(`Concurrency test: ${successes} succeeded, ${failures} rejected, ${errors} errors`);
    console.log(`Final balance: ${finalBalance}, locked: ${finalLocked}, available: ${(finalBalance - finalLocked).toFixed(6)}`);
  });

  it('should handle concurrent lock + release without corruption', async () => {
    const wallet = await walletService.createWallet('lock-release-user');
    const agentWallet = await walletService.createWallet('agent-wallet');
    await walletService.fundWallet(wallet.id, 20, 'usdc');

    const funded = await walletService.getWallet(wallet.id);
    const startBalance = parseFloat(funded!.balance);

    // Lock 10 tasks of $1 each
    const lockResults = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        walletService.lockFunds(wallet.id, '1.000000'),
      ),
    );
    const locked = lockResults.filter(r => r.status === 'fulfilled' && r.value === true).length;

    // Now release half and lock more concurrently
    const mixedOps = [
      // Release 5 locks (return to balance)
      ...Array.from({ length: 5 }, () =>
        walletService.refundFunds(wallet.id, '1.000000'),
      ),
      // Try to lock 5 more
      ...Array.from({ length: 5 }, () =>
        walletService.lockFunds(wallet.id, '1.000000'),
      ),
    ];

    await Promise.allSettled(mixedOps);

    // Verify invariant: balance + locked == startBalance (no money created or destroyed)
    const final = await walletService.getWallet(wallet.id);
    const totalAccountedFor = parseFloat(final!.balance) + parseFloat(final!.locked);

    // Allow tiny floating point tolerance
    expect(totalAccountedFor).toBeCloseTo(startBalance, 4);
    expect(parseFloat(final!.balance)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(final!.locked)).toBeGreaterThanOrEqual(0);

    console.log(`Mixed ops: balance=${final!.balance}, locked=${final!.locked}, total=${totalAccountedFor.toFixed(6)}`);
  });

  it('should handle 100 concurrent full task cycles on same wallet', async () => {
    const orchWallet = await walletService.createWallet('stress-orch');
    const agentWallet = await walletService.createWallet('stress-agent');
    await walletService.fundWallet(orchWallet.id, 200, 'usdc');

    const funded = await walletService.getWallet(orchWallet.id);
    const startBalance = parseFloat(funded!.balance);
    const taskAmount = '1.000000';
    const netAmount = '0.970000'; // after 3% fee

    // Run 100 concurrent lock → release cycles
    const cycles = Array.from({ length: 100 }, async () => {
      const locked = await walletService.lockFunds(orchWallet.id, taskAmount);
      if (!locked) return 'insufficient';

      // Simulate task completion → release to agent
      const released = await walletService.releaseFunds(
        orchWallet.id,
        agentWallet.id,
        taskAmount,
        netAmount,
      );
      return released ? 'completed' : 'release-failed';
    });

    const results = await Promise.allSettled(cycles);
    const completed = results.filter(
      r => r.status === 'fulfilled' && r.value === 'completed',
    ).length;
    const insufficient = results.filter(
      r => r.status === 'fulfilled' && r.value === 'insufficient',
    ).length;

    // Verify orchestrator: balance decreased by completed * 1.0
    const finalOrch = await walletService.getWallet(orchWallet.id);
    expect(parseFloat(finalOrch!.balance)).toBeCloseTo(startBalance - completed, 2);
    expect(parseFloat(finalOrch!.locked)).toBeCloseTo(0, 4);

    // Verify agent: balance increased by completed * 0.97
    const finalAgent = await walletService.getWallet(agentWallet.id);
    expect(parseFloat(finalAgent!.balance)).toBeCloseTo(completed * 0.97, 2);

    // Total USDC in system = orch balance + agent balance + fees (completed * 0.03)
    const totalInSystem =
      parseFloat(finalOrch!.balance) +
      parseFloat(finalAgent!.balance);
    const feesCollected = completed * 0.03;
    expect(totalInSystem + feesCollected).toBeCloseTo(startBalance, 1);

    console.log(`Stress test: ${completed} completed, ${insufficient} insufficient, fees: $${feesCollected.toFixed(4)}`);
  });

  it('should handle concurrent withdrawals without overdraw', async () => {
    const wallet = await walletService.createWallet('withdraw-race-user');
    await walletService.fundWallet(wallet.id, 10, 'usdc');

    const funded = await walletService.getWallet(wallet.id);
    const startBalance = parseFloat(funded!.balance);

    // Fire 20 concurrent withdrawals of $1 each on a ~$9.95 balance
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        walletService.withdraw(wallet.id, '1.000000', '0xDestination'),
      ),
    );

    const successes = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected').length;

    // At most floor(startBalance) withdrawals should succeed
    expect(successes).toBeLessThanOrEqual(Math.floor(startBalance));

    // Final balance should be >= 0
    const final = await walletService.getWallet(wallet.id);
    expect(parseFloat(final!.balance)).toBeGreaterThanOrEqual(0);

    console.log(`Withdraw race: ${successes} succeeded, ${failures} failed, final balance: ${final!.balance}`);
  });
});
```

- [ ] **Step 2: Run the concurrency test**

Run: `cd /Users/drpraize/agntly && pnpm test:integration`
Expected: All tests pass. The key assertion is that 100 concurrent locks on a $50 wallet result in exactly 49 successes and 51 failures — never an overdraw.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/concurrency.test.ts
git commit -m "test: add 100x concurrent wallet lock stress test proving no overdraw"
```

---

## Summary

| Task | What it does | Files touched |
|------|-------------|---------------|
| 1 | Extend event types for saga | `shared/src/types/index.ts` |
| 2 | Expose raw pool for transactions | `shared/src/db/connection.ts` |
| 3 | Wallet repository with atomic ops | `services/wallet-service/src/repositories/wallet-repository.ts` (new) |
| 4 | WalletService uses repo + events | `services/wallet-service/src/services/wallet-service.ts` |
| 5 | Escrow repository with state machine | `services/escrow-engine/src/repositories/escrow-repository.ts` (new) |
| 6 | EscrowService uses repo + events | `services/escrow-engine/src/services/escrow-service.ts` |
| 7 | Task repository + TaskService rewrite | `services/task-service/src/repositories/task-repository.ts` (new), `services/task-service/src/services/task-service.ts` |
| 8 | Wire DB + EventBus into server.ts | 3 server.ts files |
| 9 | Fix route handlers for new signatures | 3 route files |
| 10 | Integration test infrastructure | `tests/integration/setup.ts`, `vitest.integration.config.ts`, `package.json` |
| 11 | Critical path integration test | `tests/integration/critical-path.test.ts` |
| 12 | 100x concurrency stress test | `tests/integration/concurrency.test.ts` |

**Total: 12 tasks, ~15 files, proving the money path is correct under load.**
