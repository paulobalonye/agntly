# Dispute Resolution + Anti-Spoofing + Trustless Settlement Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dispute resolution flow (open → evidence → admin resolve), prevent unauthorized task completion calls from draining revenue, and connect the off-chain escrow engine to the on-chain AgntlyEscrow.sol contract for trustless, verifiable settlement.

**Architecture:** Three subsystems that reinforce each other:
1. **Disputes** — Off-chain state machine (`disputed → resolved_release | resolved_refund`) with evidence submission, admin endpoint, and on-chain `resolveDispute()` call. The on-chain contract already has this function — we wire the off-chain flow to it.
2. **Anti-spoofing** — Task completion is only accepted from the agent that was assigned the task, verified via API key ownership. Adds HMAC-signed completion tokens so agents can't spoof each other's completions.
3. **Settlement worker** — The 8th microservice. Listens for `escrow.released` events, submits `releaseEscrow()` on-chain via viem, manages nonces, retries, and gas. The on-chain contract is the source of truth — it holds the USDC and only releases on valid signals.

**Tech Stack:** viem (chain interaction), HMAC-SHA256 (completion tokens), Drizzle ORM, Redis Streams, Vitest

**Depends on:** Plan 1 (wallet concurrency + saga events) must be implemented first. This plan assumes repositories and EventBus are wired up.

---

## File Structure

### Dispute resolution
- **Create:** `services/escrow-engine/src/services/dispute-service.ts` — Dispute lifecycle management
- **Modify:** `services/escrow-engine/src/routes/escrow.ts` — Add dispute resolution + evidence endpoints
- **Modify:** `services/escrow-engine/src/db/schema.ts` — Add dispute_evidence_url, resolved_by columns
- **Modify:** `shared/src/types/index.ts` — Add `escrow.dispute_resolved` event type

### Anti-spoofing
- **Create:** `shared/src/crypto/completion-token.ts` — HMAC-based completion token generation and verification
- **Modify:** `services/task-service/src/services/task-service.ts` — Generate completion token on dispatch, verify on complete
- **Modify:** `services/task-service/src/routes/tasks.ts` — Require auth + completion token on POST /:taskId/complete
- **Modify:** `services/auth-service/src/middleware/auth.ts` — Validate API key → userId mapping for agent ownership check

### Settlement worker (8th microservice)
- **Create:** `services/settlement-worker/` — Full microservice scaffold
  - `src/server.ts` — Entry point, subscribes to escrow events
  - `src/services/settlement-service.ts` — On-chain tx submission logic
  - `src/services/gas-manager.ts` — Gas estimation, nonce management, balance monitoring
  - `src/db/schema.ts` — Settlement records table
  - `src/repositories/settlement-repository.ts` — Track settlement tx status
  - `package.json`, `tsconfig.json`
- **Modify:** `docker-compose.yml` — Add settlement-worker service
- **Modify:** `shared/src/config/index.ts` — Add settlement port
- **Modify:** `scripts/migrate.sql` — Add settlements table

### Tests
- **Create:** `tests/integration/disputes.test.ts` — Dispute lifecycle tests
- **Create:** `tests/integration/anti-spoofing.test.ts` — Completion token verification tests
- **Create:** `tests/integration/settlement.test.ts` — Settlement worker tests (with mock chain)

---

## Task 1: Add dispute resolution events to shared types

**Files:**
- Modify: `shared/src/types/index.ts`

- [ ] **Step 1: Extend WebhookEvent with dispute events**

Add these to the `WebhookEvent` union in `shared/src/types/index.ts`:

```typescript
  | 'escrow.dispute_opened'
  | 'escrow.dispute_resolved'
  | 'settlement.submitted'
  | 'settlement.confirmed'
  | 'settlement.failed'
```

- [ ] **Step 2: Add DisputeResolution interface**

Add to `shared/src/types/index.ts`:

```typescript
export type DisputeDecision = 'release_to_agent' | 'refund_to_orchestrator';

export interface DisputeResolution {
  readonly escrowId: string;
  readonly decision: DisputeDecision;
  readonly resolvedBy: string;
  readonly reason: string;
  readonly onChainTxHash: string | null;
  readonly resolvedAt: Date;
}
```

- [ ] **Step 3: Verify shared builds**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/shared build`

- [ ] **Step 4: Commit**

```bash
git add shared/src/types/index.ts
git commit -m "feat: add dispute resolution and settlement event types"
```

---

## Task 2: Create HMAC completion token system (anti-spoofing)

When a task is dispatched to an agent, the system generates a cryptographic completion token. Only the holder of this token can mark the task as complete. The token is HMAC-SHA256 signed with a server-side secret, binding it to the specific taskId + agentId.

**Files:**
- Create: `shared/src/crypto/completion-token.ts`
- Modify: `shared/src/index.ts`

- [ ] **Step 1: Write the completion token module**

Create `shared/src/crypto/completion-token.ts`:

```typescript
import { createHmac, timingSafeEqual } from 'node:crypto';

const COMPLETION_SECRET = process.env.COMPLETION_TOKEN_SECRET ?? 'dev-completion-secret-change-in-production';

/**
 * Generate a completion token that proves the holder is authorized
 * to complete a specific task. Bound to taskId + agentId.
 *
 * The token is sent to the agent when the task is dispatched.
 * The agent must return this token when calling task.complete().
 */
export function generateCompletionToken(taskId: string, agentId: string): string {
  const payload = `${taskId}:${agentId}`;
  const hmac = createHmac('sha256', COMPLETION_SECRET).update(payload).digest('hex');
  return `ctk_${hmac}`;
}

/**
 * Verify a completion token is valid for the given task + agent pair.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyCompletionToken(
  token: string,
  taskId: string,
  agentId: string,
): boolean {
  if (!token.startsWith('ctk_')) return false;

  const expected = generateCompletionToken(taskId, agentId);

  // Timing-safe comparison
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}
```

- [ ] **Step 2: Add to shared barrel export**

Add to `shared/src/index.ts`:

```typescript
export * from './crypto/completion-token.js';
```

- [ ] **Step 3: Verify shared builds**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/shared build`

- [ ] **Step 4: Commit**

```bash
git add shared/src/crypto/completion-token.ts shared/src/index.ts
git commit -m "feat: add HMAC completion token for anti-spoofing task completion"
```

---

## Task 3: Wire completion tokens into TaskService

When a task is created/dispatched, the service generates a completion token and returns it to the caller (who passes it to the agent). When `completeTask` is called, the token must be provided and verified.

**Files:**
- Modify: `services/task-service/src/services/task-service.ts`
- Modify: `services/task-service/src/routes/tasks.ts`

- [ ] **Step 1: Update TaskService to generate and verify tokens**

In `services/task-service/src/services/task-service.ts`, add these changes:

1. Import `generateCompletionToken` and `verifyCompletionToken` from `@agntly/shared`
2. In `createTask()`, after creating the task, generate the completion token:
   ```typescript
   const completionToken = generateCompletionToken(id, agentId);
   ```
   Return the token alongside the task (as a separate field — NOT stored in DB, regenerated when needed).

3. In `completeTask()`, add a `completionToken` parameter and verify it:
   ```typescript
   async completeTask(
     taskId: string,
     result: Record<string, unknown>,
     completionToken: string,
   ): Promise<TaskRow> {
     const task = await this.repo.findById(taskId);
     if (!task) throw new Error('Task not found');

     // Anti-spoofing: verify the caller has the valid completion token
     if (!verifyCompletionToken(completionToken, taskId, task.agentId)) {
       throw new Error('Invalid completion token — only the assigned agent can complete this task');
     }
     // ... rest of completion logic
   }
   ```

- [ ] **Step 2: Update task routes to require completion token**

In `services/task-service/src/routes/tasks.ts`, update the `POST /:taskId/complete` handler:

```typescript
const completeSchema = z.object({
  result: z.record(z.unknown()),
  completionToken: z.string().startsWith('ctk_'),
  proof: z.string().optional(),
});

app.post('/:taskId/complete', async (request, reply) => {
  const { taskId } = request.params as { taskId: string };
  const parsed = completeSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send(createErrorResponse('Invalid request: completionToken is required'));
  }
  try {
    const task = await taskService.completeTask(taskId, parsed.data.result, parsed.data.completionToken);
    return reply.status(200).send(createApiResponse(task));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Complete failed';
    const status = msg.includes('completion token') ? 403 : 400;
    return reply.status(status).send(createErrorResponse(msg));
  }
});
```

Also update `POST /` (createTask) response to include the completion token:

```typescript
app.post('/', async (request, reply) => {
  // ... existing validation ...
  const { task, completionToken } = await taskService.createTask(/* ... */);
  return reply.status(202).send(createApiResponse({ ...task, completionToken }));
});
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/task-service build`

- [ ] **Step 4: Commit**

```bash
git add services/task-service/src/services/task-service.ts services/task-service/src/routes/tasks.ts
git commit -m "feat: require HMAC completion token to prevent spoofed task completions"
```

---

## Task 4: Add dispute resolution to EscrowService

The on-chain contract already has `resolveDispute(escrowId, winner)`. We need the off-chain flow:
1. Orchestrator opens dispute (already exists: `POST /escrow/:id/dispute`)
2. Either party submits evidence (new: `POST /escrow/:id/evidence`)
3. Admin resolves (new: `POST /escrow/:id/resolve`)
4. Settlement worker submits `resolveDispute()` on-chain

**Files:**
- Create: `services/escrow-engine/src/services/dispute-service.ts`
- Modify: `services/escrow-engine/src/routes/escrow.ts`

- [ ] **Step 1: Create DisputeService**

Create `services/escrow-engine/src/services/dispute-service.ts`:

```typescript
import type { EventBus } from '@agntly/shared';
import type { EscrowRepository } from '../repositories/escrow-repository.js';
import type { DisputeDecision } from '@agntly/shared';

export class DisputeService {
  constructor(
    private readonly escrowRepo: EscrowRepository,
    private readonly eventBus?: EventBus,
  ) {}

  /**
   * Submit evidence for an active dispute.
   * Either party (orchestrator or agent owner) can submit evidence.
   */
  async submitEvidence(
    escrowId: string,
    submittedBy: string,
    evidence: string,
  ): Promise<void> {
    const escrow = await this.escrowRepo.findById(escrowId);
    if (!escrow) throw new Error('Escrow not found');
    if (escrow.state !== 'disputed') throw new Error('Escrow is not in disputed state');

    await this.escrowRepo.addAuditEntry({
      escrowId,
      action: 'evidence_submitted',
      actor: submittedBy,
      details: evidence,
    });
  }

  /**
   * Admin resolves a dispute. Decides to release to agent or refund to orchestrator.
   * This triggers the settlement worker to call resolveDispute() on-chain.
   */
  async resolveDispute(
    escrowId: string,
    decision: DisputeDecision,
    resolvedBy: string,
    reason: string,
  ): Promise<void> {
    const escrow = await this.escrowRepo.findById(escrowId);
    if (!escrow) throw new Error('Escrow not found');
    if (escrow.state !== 'disputed') throw new Error('Escrow is not in disputed state');

    const toState = decision === 'release_to_agent' ? 'released' : 'refunded';
    const transitioned = await this.escrowRepo.transition(escrowId, 'disputed', toState as any);
    if (!transitioned) throw new Error('Failed to transition escrow state');

    await this.escrowRepo.addAuditEntry({
      escrowId,
      action: 'dispute_resolved',
      actor: resolvedBy,
      details: `Decision: ${decision}. Reason: ${reason}`,
    });

    if (this.eventBus) {
      await this.eventBus.publish('escrow.dispute_resolved', {
        escrowId,
        taskId: escrow.taskId,
        decision,
        resolvedBy,
        fromWalletId: escrow.fromWalletId,
        toWalletId: escrow.toWalletId,
        amount: escrow.amount,
        fee: escrow.fee,
      });
    }
  }
}
```

- [ ] **Step 2: Add dispute routes**

Add to `services/escrow-engine/src/routes/escrow.ts`:

```typescript
// POST /:escrowId/evidence — submit dispute evidence
app.post('/:escrowId/evidence', async (request, reply) => {
  const { escrowId } = request.params as { escrowId: string };
  const body = request.body as { evidence: string; submittedBy: string };
  try {
    await disputeService.submitEvidence(escrowId, body.submittedBy, body.evidence);
    return reply.status(200).send(createApiResponse({ submitted: true }));
  } catch (err) {
    return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Evidence submission failed'));
  }
});

// POST /:escrowId/resolve — admin resolves dispute
app.post('/:escrowId/resolve', async (request, reply) => {
  const { escrowId } = request.params as { escrowId: string };
  const resolveSchema = z.object({
    decision: z.enum(['release_to_agent', 'refund_to_orchestrator']),
    reason: z.string().min(1),
    resolvedBy: z.string(),
  });
  const parsed = resolveSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send(createErrorResponse('Invalid resolve request'));

  try {
    await disputeService.resolveDispute(
      escrowId,
      parsed.data.decision,
      parsed.data.resolvedBy,
      parsed.data.reason,
    );
    return reply.status(200).send(createApiResponse({ resolved: true, decision: parsed.data.decision }));
  } catch (err) {
    return reply.status(400).send(createErrorResponse(err instanceof Error ? err.message : 'Resolution failed'));
  }
});
```

Note: The `/resolve` endpoint should eventually be admin-only (check `request.userRole === 'admin'`). For now, document this as a TODO in the code.

- [ ] **Step 3: Verify build**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/escrow-engine build`

- [ ] **Step 4: Commit**

```bash
git add services/escrow-engine/src/services/dispute-service.ts services/escrow-engine/src/routes/escrow.ts
git commit -m "feat: add dispute evidence submission and admin resolution flow"
```

---

## Task 5: Scaffold settlement-worker microservice

This is the 8th microservice. It bridges off-chain events to on-chain transactions.

**Files:**
- Create: `services/settlement-worker/package.json`
- Create: `services/settlement-worker/tsconfig.json`
- Create: `services/settlement-worker/src/server.ts`
- Modify: `shared/src/config/index.ts` — Add settlement port

- [ ] **Step 1: Add settlement port to config**

In `shared/src/config/index.ts`, add to `SERVICE_PORTS`:

```typescript
export const SERVICE_PORTS = {
  auth: 3001,
  wallet: 3002,
  escrow: 3003,
  task: 3004,
  registry: 3005,
  payment: 3006,
  webhook: 3007,
  settlement: 3008,
} as const;
```

- [ ] **Step 2: Create package.json**

Create `services/settlement-worker/package.json`:

```json
{
  "name": "@agntly/settlement-worker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@agntly/shared": "workspace:*",
    "fastify": "^5.2.0",
    "@fastify/cors": "^10.0.0",
    "ioredis": "^5.4.0",
    "viem": "^2.23.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

Create `services/settlement-worker/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [{ "path": "../../shared" }]
}
```

- [ ] **Step 4: Create server entry point**

Create `services/settlement-worker/src/server.ts`:

```typescript
import Fastify from 'fastify';
import { SERVICE_PORTS, EventBus } from '@agntly/shared';
import type { ServiceMessage } from '@agntly/shared';
import { SettlementService } from './services/settlement-service.js';

const eventBus = new EventBus('settlement-worker');
const settlementService = new SettlementService();

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

// Health check
app.get('/health', async () => ({
  status: 'ok',
  service: 'settlement-worker',
  timestamp: new Date().toISOString(),
}));

// Subscribe to escrow events and process settlements
async function startEventLoop() {
  await eventBus.subscribe(
    async (message: ServiceMessage) => {
      app.log.info({ eventType: message.type, eventId: message.id }, 'Processing settlement event');

      try {
        if (message.type === 'escrow.released') {
          await settlementService.submitRelease(message.data);
        } else if (message.type === 'escrow.refunded') {
          await settlementService.submitRefund(message.data);
        } else if (message.type === 'escrow.dispute_resolved') {
          await settlementService.submitDisputeResolution(message.data);
        }
      } catch (err) {
        app.log.error({ err, eventId: message.id }, 'Settlement processing failed — will retry');
        // TODO: Dead letter queue for failed settlements
      }
    },
    ['escrow.released', 'escrow.refunded', 'escrow.dispute_resolved'],
  );
}

const port = SERVICE_PORTS.settlement;
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`settlement-worker running on ${host}:${port}`);
  await startEventLoop();
  app.log.info('Settlement event loop started');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
```

- [ ] **Step 5: Install deps and verify**

Run: `cd /Users/drpraize/agntly && pnpm install`

- [ ] **Step 6: Commit**

```bash
git add services/settlement-worker/ shared/src/config/index.ts
git commit -m "feat: scaffold settlement-worker as 8th microservice"
```

---

## Task 6: Implement SettlementService with on-chain interaction

**Files:**
- Create: `services/settlement-worker/src/services/settlement-service.ts`
- Create: `services/settlement-worker/src/services/gas-manager.ts`

- [ ] **Step 1: Create GasManager**

Create `services/settlement-worker/src/services/gas-manager.ts`:

```typescript
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const RPC_URL = process.env.BASE_RPC_URL ?? 'https://sepolia.base.org';
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const MIN_ETH_BALANCE = parseEther('0.01');

export class GasManager {
  private nonce: number | null = null;
  private readonly chain = baseSepolia;

  readonly publicClient = createPublicClient({
    chain: this.chain,
    transport: http(RPC_URL),
  });

  readonly walletClient = RELAYER_PRIVATE_KEY
    ? createWalletClient({
        account: privateKeyToAccount(RELAYER_PRIVATE_KEY as `0x${string}`),
        chain: this.chain,
        transport: http(RPC_URL),
      })
    : null;

  /**
   * Get the next nonce, managing sequential submission.
   * Fetches from chain on first call, then increments locally.
   */
  async getNextNonce(): Promise<number> {
    if (this.nonce === null || this.nonce % 20 === 0) {
      // Re-sync with chain every 20 txs to recover from any drift
      const account = this.walletClient?.account;
      if (!account) throw new Error('No relayer wallet configured');
      this.nonce = await this.publicClient.getTransactionCount({ address: account.address });
    }
    return this.nonce++;
  }

  /**
   * Check relayer wallet has enough ETH for gas.
   * Returns false and logs a warning if balance is below threshold.
   */
  async checkGasBalance(): Promise<boolean> {
    const account = this.walletClient?.account;
    if (!account) return false;
    const balance = await this.publicClient.getBalance({ address: account.address });
    if (balance < MIN_ETH_BALANCE) {
      console.error(`[GasManager] ALERT: Relayer ETH balance low: ${balance}. Min required: ${MIN_ETH_BALANCE}`);
      return false;
    }
    return true;
  }

  /**
   * Reset nonce tracking (e.g., after a nonce collision error).
   */
  resetNonce(): void {
    this.nonce = null;
  }
}
```

- [ ] **Step 2: Create SettlementService**

Create `services/settlement-worker/src/services/settlement-service.ts`:

```typescript
import { parseAbi, encodeFunctionData, type Hex } from 'viem';
import { GasManager } from './gas-manager.js';

const ESCROW_CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS as `0x${string}` | undefined;

const ESCROW_ABI = parseAbi([
  'function releaseEscrow(bytes32 escrowId, bytes32 resultHash) external',
  'function refundEscrow(bytes32 escrowId) external',
  'function resolveDispute(bytes32 escrowId, address winner) external',
]);

export class SettlementService {
  private readonly gasManager = new GasManager();

  /**
   * Submit an on-chain releaseEscrow transaction.
   * Called when the off-chain escrow state transitions to 'released'.
   */
  async submitRelease(data: Record<string, unknown>): Promise<string | null> {
    if (!ESCROW_CONTRACT_ADDRESS || !this.gasManager.walletClient) {
      console.log('[Settlement] No contract configured — skipping on-chain settlement (dev mode)');
      return null;
    }

    const hasGas = await this.gasManager.checkGasBalance();
    if (!hasGas) throw new Error('Insufficient gas balance for settlement');

    const escrowId = data.escrowId as string;
    const resultHash = (data.resultHash as string) ?? '0x' + '0'.repeat(64);

    const txHash = await this.gasManager.walletClient.writeContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      functionName: 'releaseEscrow',
      args: [escrowId as Hex, resultHash as Hex],
      nonce: await this.gasManager.getNextNonce(),
    });

    console.log(`[Settlement] Release tx submitted: ${txHash}`);

    // Wait for confirmation
    const receipt = await this.gasManager.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === 'reverted') {
      this.gasManager.resetNonce();
      throw new Error(`Release tx reverted: ${txHash}`);
    }

    console.log(`[Settlement] Release confirmed in block ${receipt.blockNumber}`);
    return txHash;
  }

  /**
   * Submit an on-chain refundEscrow transaction.
   * Called when escrow times out and state transitions to 'refunded'.
   */
  async submitRefund(data: Record<string, unknown>): Promise<string | null> {
    if (!ESCROW_CONTRACT_ADDRESS || !this.gasManager.walletClient) {
      console.log('[Settlement] No contract configured — skipping (dev mode)');
      return null;
    }

    const hasGas = await this.gasManager.checkGasBalance();
    if (!hasGas) throw new Error('Insufficient gas balance for settlement');

    const escrowId = data.escrowId as string;

    const txHash = await this.gasManager.walletClient.writeContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      functionName: 'refundEscrow',
      args: [escrowId as Hex],
      nonce: await this.gasManager.getNextNonce(),
    });

    const receipt = await this.gasManager.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === 'reverted') {
      this.gasManager.resetNonce();
      throw new Error(`Refund tx reverted: ${txHash}`);
    }

    return txHash;
  }

  /**
   * Submit an on-chain resolveDispute transaction.
   * Called when admin resolves a dispute off-chain.
   */
  async submitDisputeResolution(data: Record<string, unknown>): Promise<string | null> {
    if (!ESCROW_CONTRACT_ADDRESS || !this.gasManager.walletClient) {
      console.log('[Settlement] No contract configured — skipping (dev mode)');
      return null;
    }

    const hasGas = await this.gasManager.checkGasBalance();
    if (!hasGas) throw new Error('Insufficient gas balance for settlement');

    const escrowId = data.escrowId as string;
    const decision = data.decision as string;
    // Winner address: agent wallet for release, orchestrator wallet for refund
    const winnerAddress = decision === 'release_to_agent'
      ? (data.toWalletId as string)
      : (data.fromWalletId as string);

    const txHash = await this.gasManager.walletClient.writeContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      functionName: 'resolveDispute',
      args: [escrowId as Hex, winnerAddress as `0x${string}`],
      nonce: await this.gasManager.getNextNonce(),
    });

    const receipt = await this.gasManager.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === 'reverted') {
      this.gasManager.resetNonce();
      throw new Error(`Dispute resolution tx reverted: ${txHash}`);
    }

    return txHash;
  }
}
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/drpraize/agntly && pnpm --filter @agntly/settlement-worker build`

- [ ] **Step 4: Commit**

```bash
git add services/settlement-worker/src/services/
git commit -m "feat: implement settlement service with on-chain viem interaction and gas management"
```

---

## Task 7: Add settlement-worker to Docker Compose

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add settlement-worker service**

Add before the `volumes:` section in `docker-compose.yml`:

```yaml
  settlement-worker:
    build:
      context: .
      dockerfile: services/settlement-worker/Dockerfile
    ports:
      - "3008:3008"
    env_file: .env
    environment:
      - ESCROW_CONTRACT_ADDRESS=${ESCROW_CONTRACT_ADDRESS:-}
      - RELAYER_PRIVATE_KEY=${RELAYER_PRIVATE_KEY:-}
      - BASE_RPC_URL=${BASE_RPC_URL:-https://sepolia.base.org}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add settlement-worker to docker-compose"
```

---

## Task 8: Write anti-spoofing integration test

**Files:**
- Create: `tests/integration/anti-spoofing.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/integration/anti-spoofing.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, cleanTestDb, teardownTestDb } from './setup.js';
import { TaskRepository } from '../../services/task-service/src/repositories/task-repository.js';
import { TaskService } from '../../services/task-service/src/services/task-service.js';
import { generateCompletionToken } from '@agntly/shared';
import type { DbConnection } from '@agntly/shared';

let db: DbConnection;
let taskService: TaskService;

describe('Anti-Spoofing: Completion Token Verification', () => {
  beforeAll(async () => {
    const setup = await setupTestDb();
    db = setup.db;
    const taskRepo = new TaskRepository(db);
    taskService = new TaskService(taskRepo);
  });

  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await cleanTestDb(); });

  it('should accept completion with valid token', async () => {
    const { task, completionToken } = await taskService.createTask(
      'orch-1', 'agent-search', { query: 'test' }, '1.000000',
    );
    await taskService.markEscrowed(task.id, '0xabc');

    const completed = await taskService.completeTask(
      task.id,
      { answer: 'result' },
      completionToken,
    );
    expect(completed.status).toBe('complete');
  });

  it('should reject completion with wrong token', async () => {
    const { task } = await taskService.createTask(
      'orch-1', 'agent-search', { query: 'test' }, '1.000000',
    );
    await taskService.markEscrowed(task.id, '0xabc');

    await expect(
      taskService.completeTask(task.id, { answer: 'result' }, 'ctk_invalid_token'),
    ).rejects.toThrow('Invalid completion token');
  });

  it('should reject completion with token for different agent', async () => {
    const { task } = await taskService.createTask(
      'orch-1', 'agent-search', { query: 'test' }, '1.000000',
    );
    await taskService.markEscrowed(task.id, '0xabc');

    // Generate a valid token but for a DIFFERENT agent
    const wrongAgentToken = generateCompletionToken(task.id, 'agent-DIFFERENT');

    await expect(
      taskService.completeTask(task.id, { answer: 'result' }, wrongAgentToken),
    ).rejects.toThrow('Invalid completion token');
  });

  it('should reject completion with token for different task', async () => {
    const { task } = await taskService.createTask(
      'orch-1', 'agent-search', { query: 'test' }, '1.000000',
    );
    await taskService.markEscrowed(task.id, '0xabc');

    // Generate a valid token but for a DIFFERENT task
    const wrongTaskToken = generateCompletionToken('tsk_different_id', 'agent-search');

    await expect(
      taskService.completeTask(task.id, { answer: 'result' }, wrongTaskToken),
    ).rejects.toThrow('Invalid completion token');
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd /Users/drpraize/agntly && pnpm test:integration`

- [ ] **Step 3: Commit**

```bash
git add tests/integration/anti-spoofing.test.ts
git commit -m "test: add anti-spoofing integration tests for completion token verification"
```

---

## Task 9: Write dispute resolution integration test

**Files:**
- Create: `tests/integration/disputes.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/integration/disputes.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, cleanTestDb, teardownTestDb } from './setup.js';
import { EscrowRepository } from '../../services/escrow-engine/src/repositories/escrow-repository.js';
import { EscrowService } from '../../services/escrow-engine/src/services/escrow-service.js';
import { DisputeService } from '../../services/escrow-engine/src/services/dispute-service.js';
import type { DbConnection } from '@agntly/shared';

let db: DbConnection;
let escrowService: EscrowService;
let disputeService: DisputeService;

describe('Dispute Resolution Flow', () => {
  beforeAll(async () => {
    const setup = await setupTestDb();
    db = setup.db;
    const escrowRepo = new EscrowRepository(db);
    escrowService = new EscrowService(escrowRepo);
    disputeService = new DisputeService(escrowRepo);
  });

  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await cleanTestDb(); });

  it('should complete full dispute lifecycle: open → evidence → resolve (release)', async () => {
    // Create and lock escrow
    const escrow = await escrowService.lockEscrow({
      taskId: 'tsk_dispute_1',
      fromWalletId: '00000000-0000-0000-0000-000000000001',
      toWalletId: '00000000-0000-0000-0000-000000000002',
      amount: '5.000000',
      deadline: new Date(Date.now() + 60_000),
    });

    // Orchestrator opens dispute
    const disputed = await escrowService.disputeEscrow(escrow.id, 'Agent returned garbage');
    expect(disputed.state).toBe('disputed');

    // Both parties submit evidence
    await disputeService.submitEvidence(escrow.id, 'orchestrator-user', 'Expected JSON, got HTML');
    await disputeService.submitEvidence(escrow.id, 'agent-user', 'Server was under load, output is valid');

    // Admin resolves in favor of agent
    await disputeService.resolveDispute(escrow.id, 'release_to_agent', 'admin-1', 'Agent output was valid');

    const resolved = await escrowService.getEscrow(escrow.id);
    expect(resolved!.state).toBe('released');
    expect(resolved!.settledAt).not.toBeNull();
  });

  it('should complete dispute lifecycle: open → resolve (refund)', async () => {
    const escrow = await escrowService.lockEscrow({
      taskId: 'tsk_dispute_2',
      fromWalletId: '00000000-0000-0000-0000-000000000001',
      toWalletId: '00000000-0000-0000-0000-000000000002',
      amount: '3.000000',
      deadline: new Date(Date.now() + 60_000),
    });

    await escrowService.disputeEscrow(escrow.id, 'Agent never responded');
    await disputeService.resolveDispute(escrow.id, 'refund_to_orchestrator', 'admin-1', 'Agent was unresponsive');

    const resolved = await escrowService.getEscrow(escrow.id);
    expect(resolved!.state).toBe('refunded');
  });

  it('should reject evidence on non-disputed escrow', async () => {
    const escrow = await escrowService.lockEscrow({
      taskId: 'tsk_dispute_3',
      fromWalletId: '00000000-0000-0000-0000-000000000001',
      toWalletId: '00000000-0000-0000-0000-000000000002',
      amount: '1.000000',
      deadline: new Date(Date.now() + 60_000),
    });

    await expect(
      disputeService.submitEvidence(escrow.id, 'user', 'Some evidence'),
    ).rejects.toThrow('not in disputed state');
  });

  it('should reject resolve on non-disputed escrow', async () => {
    const escrow = await escrowService.lockEscrow({
      taskId: 'tsk_dispute_4',
      fromWalletId: '00000000-0000-0000-0000-000000000001',
      toWalletId: '00000000-0000-0000-0000-000000000002',
      amount: '1.000000',
      deadline: new Date(Date.now() + 60_000),
    });

    await expect(
      disputeService.resolveDispute(escrow.id, 'release_to_agent', 'admin', 'reason'),
    ).rejects.toThrow('not in disputed state');
  });

  it('should prevent double-resolve', async () => {
    const escrow = await escrowService.lockEscrow({
      taskId: 'tsk_dispute_5',
      fromWalletId: '00000000-0000-0000-0000-000000000001',
      toWalletId: '00000000-0000-0000-0000-000000000002',
      amount: '1.000000',
      deadline: new Date(Date.now() + 60_000),
    });

    await escrowService.disputeEscrow(escrow.id, 'Bad output');
    await disputeService.resolveDispute(escrow.id, 'release_to_agent', 'admin', 'Valid');

    // Second resolve should fail
    await expect(
      disputeService.resolveDispute(escrow.id, 'refund_to_orchestrator', 'admin', 'Changed mind'),
    ).rejects.toThrow('not in disputed state');
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd /Users/drpraize/agntly && pnpm test:integration`

- [ ] **Step 3: Commit**

```bash
git add tests/integration/disputes.test.ts
git commit -m "test: add dispute resolution lifecycle integration tests"
```

---

## Summary

| Task | What it does | Files touched |
|------|-------------|---------------|
| 1 | Dispute + settlement event types | `shared/src/types/index.ts` |
| 2 | HMAC completion token module | `shared/src/crypto/completion-token.ts` (new) |
| 3 | Wire tokens into TaskService + routes | `task-service` service + routes |
| 4 | DisputeService + resolution routes | `escrow-engine` new service + routes |
| 5 | Scaffold settlement-worker (8th service) | `services/settlement-worker/` (new) |
| 6 | SettlementService + GasManager | `settlement-worker` services (new) |
| 7 | Add to Docker Compose | `docker-compose.yml` |
| 8 | Anti-spoofing integration tests | `tests/integration/anti-spoofing.test.ts` (new) |
| 9 | Dispute resolution integration tests | `tests/integration/disputes.test.ts` (new) |

**Total: 9 tasks, ~12 new files, covering all 3 subsystems.**

**Security model after this plan:**
- Task completion requires a cryptographic token bound to (taskId, agentId) — no spoofing possible
- Disputes follow open → evidence → admin resolve flow with full audit trail
- Settlement worker is the only component that talks to the blockchain — all other services stay off-chain
- On-chain contract is the source of truth for USDC custody — off-chain can only propose, on-chain verifies
