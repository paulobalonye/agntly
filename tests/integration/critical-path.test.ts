import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setupTestDb, cleanTestDb, teardownTestDb } from './setup.js';
import { WalletRepository } from '../../services/wallet-service/src/repositories/wallet-repository.js';
import { WalletService } from '../../services/wallet-service/src/services/wallet-service.js';
import { EscrowRepository } from '../../services/escrow-engine/src/repositories/escrow-repository.js';
import { EscrowService } from '../../services/escrow-engine/src/services/escrow-service.js';
import { TaskRepository } from '../../services/task-service/src/repositories/task-repository.js';
import { TaskService } from '../../services/task-service/src/services/task-service.js';
import { calculateFee } from '@agntly/shared';
import type { DbConnection } from '@agntly/shared';

let db: DbConnection;
let walletService: WalletService;
let escrowService: EscrowService;
let taskService: TaskService;

beforeAll(async () => {
  const ctx = await setupTestDb();
  db = ctx.db;
  const walletRepo = new WalletRepository(db);
  const escrowRepo = new EscrowRepository(db);
  const taskRepo = new TaskRepository(db);
  walletService = new WalletService(walletRepo);
  escrowService = new EscrowService(escrowRepo);
  taskService = new TaskService(taskRepo);
});

beforeEach(async () => {
  await cleanTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

describe('Critical path: full task lifecycle with correct balances', () => {
  it('funds orchestrator, runs task, verifies final balances', async () => {
    // Create orchestrator wallet and fund with $100 usdc (0.5% fee → 99.5 USDC)
    const orchWallet = await walletService.createWallet(randomUUID());
    await walletService.fundWallet(orchWallet.id, 100, 'usdc');

    // Create agent wallet (receives funds)
    const agentWallet = await walletService.createWallet(randomUUID(), 'agent-01');

    // Create task with $1 budget — calculateFee gives 3% fee → net 0.97
    const { fee: taskFee, net: taskNet } = calculateFee('1.000000');
    const { task, completionToken } = await taskService.createTask(
      orchWallet.ownerId,
      'agent-01',
      { type: 'summarize', input: 'hello world' },
      '1.000000',
    );
    expect(task.status).toBe('pending');
    expect(task.amount).toBe('1.000000');
    expect(task.fee).toBe(taskFee);

    // Lock $1 from orchestrator wallet
    const locked = await walletService.lockFunds(orchWallet.id, '1.000000');
    expect(locked).toBe(true);

    // Verify lockFunds moved balance to locked column: 99.5 - 1.0 = 98.5 balance, 1.0 locked
    const orchAfterLock = await walletService.getWallet(orchWallet.id);
    expect(parseFloat(orchAfterLock!.balance)).toBeCloseTo(98.5, 4);
    expect(parseFloat(orchAfterLock!.locked)).toBeCloseTo(1.0, 6);

    // Create escrow record
    const escrow = await escrowService.lockEscrow({
      taskId: task.id,
      fromWalletId: orchWallet.id,
      toWalletId: agentWallet.id,
      amount: '1.000000',
    });
    expect(escrow.state).toBe('locked');
    expect(escrow.amount).toBe('1.000000');

    // Mark task as escrowed
    const escrowedTask = await taskService.markEscrowed(task.id, escrow.txHash ?? 'tx-test');
    expect(escrowedTask.status).toBe('escrowed');

    // Complete task
    const completedTask = await taskService.completeTask(task.id, { output: 'summary here' }, completionToken);
    expect(completedTask.status).toBe('complete');

    // Release escrow state: locked → released
    const releasedEscrow = await escrowService.releaseEscrow(escrow.id, 'result-hash-abc');
    expect(releasedEscrow.state).toBe('released');

    // Transfer funds: deduct gross (1.0) from orch locked, credit net (0.97) to agent
    const transferred = await walletService.releaseFunds(
      orchWallet.id,
      agentWallet.id,
      '1.000000',
      taskNet,
    );
    expect(transferred).toBe(true);

    // Verify orchestrator balance ~98.5, locked 0
    const orchFinal = await walletService.getWallet(orchWallet.id);
    expect(parseFloat(orchFinal!.balance)).toBeCloseTo(98.5, 4);
    expect(parseFloat(orchFinal!.locked)).toBeCloseTo(0, 6);

    // Verify agent balance ~0.97
    const agentFinal = await walletService.getWallet(agentWallet.id);
    expect(parseFloat(agentFinal!.balance)).toBeCloseTo(parseFloat(taskNet), 6);
  });
});

describe('Critical path: refund on timeout', () => {
  it('refunds locked funds back to available balance', async () => {
    const wallet = await walletService.createWallet(randomUUID());
    await walletService.fundWallet(wallet.id, 50, 'usdc'); // 49.75 USDC

    const lockedOk = await walletService.lockFunds(wallet.id, '5.000000');
    expect(lockedOk).toBe(true);

    // Create escrow record (to wallet = same for simplicity in refund test)
    const escrow = await escrowService.lockEscrow({
      taskId: `task-refund-${randomUUID()}`,
      fromWalletId: wallet.id,
      toWalletId: wallet.id,
      amount: '5.000000',
    });
    expect(escrow.state).toBe('locked');

    // Refund escrow state: locked → refunded
    const refundedEscrow = await escrowService.refundEscrow(escrow.id);
    expect(refundedEscrow.state).toBe('refunded');

    // Refund locked funds back to available balance
    const refundedFunds = await walletService.refundFunds(wallet.id, '5.000000');
    expect(refundedFunds).toBe(true);

    // Verify balance restored, locked 0
    const walletFinal = await walletService.getWallet(wallet.id);
    expect(parseFloat(walletFinal!.balance)).toBeCloseTo(49.75, 4);
    expect(parseFloat(walletFinal!.locked)).toBeCloseTo(0, 6);
  });
});

describe('Critical path: double-release prevention', () => {
  it('throws on second release attempt with state info in message', async () => {
    const orchWallet = await walletService.createWallet(randomUUID());
    const agentWallet = await walletService.createWallet(randomUUID());
    await walletService.fundWallet(orchWallet.id, 10, 'usdc'); // 9.95 USDC
    await walletService.lockFunds(orchWallet.id, '1.000000');

    const escrow = await escrowService.lockEscrow({
      taskId: `task-double-${randomUUID()}`,
      fromWalletId: orchWallet.id,
      toWalletId: agentWallet.id,
      amount: '1.000000',
    });

    // First release succeeds
    const firstRelease = await escrowService.releaseEscrow(escrow.id);
    expect(firstRelease.state).toBe('released');

    // Second release should throw with state info
    await expect(escrowService.releaseEscrow(escrow.id)).rejects.toThrow(
      'Cannot release escrow',
    );
  });
});

describe('Critical path: insufficient funds rejection', () => {
  it('returns false when locking more than available balance, balance unchanged', async () => {
    const wallet = await walletService.createWallet(randomUUID());
    await walletService.fundWallet(wallet.id, 1, 'usdc'); // 0.995 USDC

    // Try to lock $5 → should fail (insufficient funds)
    const locked = await walletService.lockFunds(wallet.id, '5.000000');
    expect(locked).toBe(false);

    // Balance should be unchanged at 0.995
    const walletAfter = await walletService.getWallet(wallet.id);
    expect(parseFloat(walletAfter!.balance)).toBeCloseTo(0.995, 4);
    expect(parseFloat(walletAfter!.locked)).toBeCloseTo(0, 6);
  });
});

describe('Critical path: release to non-existent destination', () => {
  it('returns false and leaves source wallet locked funds unchanged', async () => {
    const wallet = await walletService.createWallet(randomUUID());
    await walletService.fundWallet(wallet.id, 10, 'usdc'); // 9.95 USDC
    await walletService.lockFunds(wallet.id, '2.000000');

    const walletBeforeRelease = await walletService.getWallet(wallet.id);
    const lockedBefore = parseFloat(walletBeforeRelease!.locked);
    expect(lockedBefore).toBeCloseTo(2.0, 6);

    // Release to a non-existent wallet UUID
    const released = await walletService.releaseFunds(
      wallet.id,
      'a0000000-0000-0000-0000-000000000000',
      '2.000000',
      '1.940000',
    );
    expect(released).toBe(false);

    // Source wallet locked should be UNCHANGED — no money destroyed
    const walletAfter = await walletService.getWallet(wallet.id);
    expect(parseFloat(walletAfter!.locked)).toBeCloseTo(lockedBefore, 6);
    // Balance also unchanged (7.95 = 9.95 - 2.0 locked)
    expect(parseFloat(walletAfter!.balance)).toBeCloseTo(7.95, 4);
  });
});
