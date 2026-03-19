import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { setupTestDb, cleanTestDb, teardownTestDb } from './setup.js';
import { WalletRepository } from '../../services/wallet-service/src/repositories/wallet-repository.js';
import { WalletService } from '../../services/wallet-service/src/services/wallet-service.js';
import type { DbConnection } from '@agntly/shared';

let db: DbConnection;
let walletService: WalletService;

beforeAll(async () => {
  const ctx = await setupTestDb();
  db = ctx.db;
  const walletRepo = new WalletRepository(db);
  walletService = new WalletService(walletRepo);
});

beforeEach(async () => {
  await cleanTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

describe('Concurrency: 100 concurrent locks on $50 wallet', () => {
  it('allows exactly floor(49.75) = 49 locks to succeed, conserves money', async () => {
    const wallet = await walletService.createWallet(randomUUID());
    // usdc method: fee = 0.5%, so $50 → 49.75 USDC
    await walletService.fundWallet(wallet.id, 50, 'usdc');

    const walletAfterFund = await walletService.getWallet(wallet.id);
    expect(parseFloat(walletAfterFund!.balance)).toBeCloseTo(49.75, 4);

    // Fire 100 concurrent lockFunds of $1 each
    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        walletService.lockFunds(wallet.id, '1.000000'),
      ),
    );

    const successes = results.filter(Boolean).length;
    const failures = results.filter((r) => !r).length;

    // floor(49.75) = 49 locks should succeed
    expect(successes).toBe(49);
    expect(failures).toBe(51);

    // Money conservation: balance + locked must equal original 49.75
    const walletFinal = await walletService.getWallet(wallet.id);
    const balance = parseFloat(walletFinal!.balance);
    const locked = parseFloat(walletFinal!.locked);
    const total = balance + locked;

    expect(total).toBeCloseTo(49.75, 4);
    expect(balance).toBeGreaterThanOrEqual(0);
    expect(locked).toBeCloseTo(49.0, 4);
  });
});

describe('Concurrency: concurrent lock + release without corruption', () => {
  it('conserves money when mixing concurrent refunds and new locks', async () => {
    const wallet = await walletService.createWallet(randomUUID());
    // $20 → 19.9 USDC
    await walletService.fundWallet(wallet.id, 20, 'usdc');

    const afterFund = await walletService.getWallet(wallet.id);
    const startBalance = parseFloat(afterFund!.balance); // 19.9

    // Lock 10 tasks of $1 sequentially first to establish known state
    for (let i = 0; i < 10; i++) {
      const ok = await walletService.lockFunds(wallet.id, '1.000000');
      expect(ok).toBe(true);
    }

    const afterInitialLocks = await walletService.getWallet(wallet.id);
    expect(parseFloat(afterInitialLocks!.locked)).toBeCloseTo(10.0, 4);
    expect(parseFloat(afterInitialLocks!.balance)).toBeCloseTo(9.9, 4);

    // Concurrently: refund 5 locks + attempt 5 more new locks
    const refundPromises = Array.from({ length: 5 }, () =>
      walletService.refundFunds(wallet.id, '1.000000'),
    );
    const lockPromises = Array.from({ length: 5 }, () =>
      walletService.lockFunds(wallet.id, '1.000000'),
    );

    const allResults = await Promise.all([...refundPromises, ...lockPromises]);
    const refundResults = allResults.slice(0, 5) as boolean[];
    const lockResults = allResults.slice(5) as boolean[];

    const successfulRefunds = refundResults.filter(Boolean).length;
    const successfulNewLocks = lockResults.filter(Boolean).length;

    // Verify money conservation: balance + locked == startBalance (19.9)
    const walletFinal = await walletService.getWallet(wallet.id);
    const finalBalance = parseFloat(walletFinal!.balance);
    const finalLocked = parseFloat(walletFinal!.locked);
    const finalTotal = finalBalance + finalLocked;

    expect(finalTotal).toBeCloseTo(startBalance, 4);
    expect(finalBalance).toBeGreaterThanOrEqual(0);
    expect(finalLocked).toBeGreaterThanOrEqual(0);

    // Total locked = 10 - refunds + new locks
    const expectedLocked = 10 - successfulRefunds + successfulNewLocks;
    expect(finalLocked).toBeCloseTo(expectedLocked, 4);
  });
});

describe('Concurrency: 100 concurrent full task cycles', () => {
  it('correctly transfers funds for all completed cycles', async () => {
    const orchWallet = await walletService.createWallet(randomUUID());
    const agentWallet = await walletService.createWallet(randomUUID());
    // $200 → 199.0 USDC (0.5% fee)
    await walletService.fundWallet(orchWallet.id, 200, 'usdc');

    const afterFund = await walletService.getWallet(orchWallet.id);
    const startBalance = parseFloat(afterFund!.balance); // 199.0

    // Run 100 concurrent: lock $1 then release $1 gross / $0.97 net
    const cycleResults = await Promise.all(
      Array.from({ length: 100 }, async () => {
        const didLock = await walletService.lockFunds(orchWallet.id, '1.000000');
        if (!didLock) return { success: false, locked: false };

        const didRelease = await walletService.releaseFunds(
          orchWallet.id,
          agentWallet.id,
          '1.000000',
          '0.970000',
        );
        return { success: didRelease, locked: true };
      }),
    );

    const completedLocks = cycleResults.filter((r) => r.locked).length;
    const completedTransfers = cycleResults.filter((r) => r.success).length;

    // floor(199.0) = 199 → 100 concurrent locks, all should succeed
    expect(completedLocks).toBe(100);
    expect(completedTransfers).toBe(100);

    // Orch balance = startBalance - (completed * gross $1)
    const orchFinal = await walletService.getWallet(orchWallet.id);
    const orchFinalBalance = parseFloat(orchFinal!.balance);
    const orchFinalLocked = parseFloat(orchFinal!.locked);

    expect(orchFinalLocked).toBeCloseTo(0, 4);
    expect(orchFinalBalance).toBeCloseTo(startBalance - completedTransfers, 4);

    // Agent balance = completed * 0.97
    const agentFinal = await walletService.getWallet(agentWallet.id);
    const agentFinalBalance = parseFloat(agentFinal!.balance);
    expect(agentFinalBalance).toBeCloseTo(completedTransfers * 0.97, 4);

    // Total + fees = startBalance (fees = completed * 0.03)
    const fees = completedTransfers * 0.03;
    const total = orchFinalBalance + agentFinalBalance + fees;
    expect(total).toBeCloseTo(startBalance, 4);
  });
});

describe('Concurrency: concurrent withdrawals', () => {
  it('at most floor(9.95) = 9 withdrawals succeed, final balance >= 0', async () => {
    const wallet = await walletService.createWallet(randomUUID());
    // $10 → 9.95 USDC
    await walletService.fundWallet(wallet.id, 10, 'usdc');

    const afterFund = await walletService.getWallet(wallet.id);
    expect(parseFloat(afterFund!.balance)).toBeCloseTo(9.95, 4);

    // Fire 20 concurrent withdrawals of $1 each
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        walletService
          .withdraw(wallet.id, '1.000000', '0xDestinationAddress', false)
          .then(() => true, () => false),
      ),
    );

    const successes = results.filter(Boolean).length;
    const failures = results.filter((r) => !r).length;

    // At most floor(9.95) = 9 can succeed
    expect(successes).toBeLessThanOrEqual(9);
    expect(successes).toBeGreaterThan(0);
    expect(failures).toBe(20 - successes);

    // Final balance must be >= 0 (never negative)
    const walletFinal = await walletService.getWallet(wallet.id);
    const finalBalance = parseFloat(walletFinal!.balance);
    expect(finalBalance).toBeGreaterThanOrEqual(0);

    // Final balance = 9.95 - (successes * 1.0)
    expect(finalBalance).toBeCloseTo(9.95 - successes * 1.0, 4);
  });
});
