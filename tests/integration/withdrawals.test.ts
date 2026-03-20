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

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb();
  });

  // Test 1: Successful withdrawal — balance debited, withdrawal record created with status 'queued'
  it('should debit balance and create queued withdrawal record', async () => {
    const wallet = await walletService.createWallet(USER_1);
    await walletService.fundWallet(wallet.id, 100, 'usdc');

    const result = await walletService.withdraw(USER_1, wallet.id, '10', VALID_DEST);

    expect(result.status).toBe('queued');
    expect(result.amount).toBe('10.000000');
    expect(result.destination).toBe(VALID_DEST);
    expect(result.fee).toBe('0.000000');

    // Verify balance debited: 100 USDC funded at 0.5% fee → 99.5, minus 10 = 89.5
    const updated = await walletService.getWallet(wallet.id);
    expect(parseFloat(updated!.balance)).toBeCloseTo(89.5, 1);

    // Verify withdrawal record exists with correct status
    const withdrawal = await withdrawalRepo.findById(result.withdrawalId);
    expect(withdrawal).not.toBeNull();
    expect(withdrawal!.status).toBe('queued');
    expect(withdrawal!.amount).toBe('10.000000');
    expect(withdrawal!.destination).toBe(VALID_DEST);
  });

  // Test 2: Wallet ownership check — rejects withdrawal from wallet not owned by user
  it('should reject withdrawal from wallet not owned by user', async () => {
    const wallet = await walletService.createWallet(USER_1);
    await walletService.fundWallet(wallet.id, 100, 'usdc');

    await expect(
      walletService.withdraw(USER_2, wallet.id, '10', VALID_DEST),
    ).rejects.toThrow('does not belong');

    // Balance unchanged at 99.5 (100 after 0.5% fee)
    const w = await walletService.getWallet(wallet.id);
    expect(parseFloat(w!.balance)).toBeCloseTo(99.5, 1);
  });

  // Test 3: Insufficient balance — rejects, no withdrawal record created
  it('should reject withdrawal when balance is insufficient', async () => {
    const wallet = await walletService.createWallet(USER_1);
    await walletService.fundWallet(wallet.id, 5, 'usdc'); // ~4.975 USDC after fee

    await expect(
      walletService.withdraw(USER_1, wallet.id, '100', VALID_DEST),
    ).rejects.toThrow('Insufficient');

    // No withdrawal records created
    const history = await walletService.getWithdrawalHistory(wallet.id, 20, 0);
    expect(history.total).toBe(0);
  });

  // Test 4: Withdrawal history — paginated results
  it('should return paginated withdrawal history', async () => {
    const wallet = await walletService.createWallet(USER_1);
    await walletService.fundWallet(wallet.id, 100, 'usdc');

    await walletService.withdraw(USER_1, wallet.id, '1', VALID_DEST);
    await walletService.withdraw(USER_1, wallet.id, '2', VALID_DEST);
    await walletService.withdraw(USER_1, wallet.id, '3', VALID_DEST);

    const page1 = await walletService.getWithdrawalHistory(wallet.id, 2, 0);
    expect(page1.withdrawals.length).toBe(2);
    expect(page1.total).toBe(3);
    expect(page1.limit).toBe(2);
    expect(page1.offset).toBe(0);

    const page2 = await walletService.getWithdrawalHistory(wallet.id, 2, 2);
    expect(page2.withdrawals.length).toBe(1);
    expect(page2.total).toBe(3);
  });

  // Test 5: 20 concurrent withdrawals on $10 wallet — no overdraw, record count matches successes
  it('should handle 20 concurrent withdrawals without overdrawing', async () => {
    const wallet = await walletService.createWallet(USER_1);
    await walletService.fundWallet(wallet.id, 10, 'usdc'); // ~9.95 USDC after 0.5% fee

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        walletService.withdraw(USER_1, wallet.id, '1.000000', VALID_DEST),
      ),
    );

    const successes = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected').length;

    // At most floor(9.95) = 9 can succeed
    expect(successes).toBeLessThanOrEqual(9);
    expect(successes + failures).toBe(20);

    // Balance must not go below zero
    const final = await walletService.getWallet(wallet.id);
    expect(parseFloat(final!.balance)).toBeGreaterThanOrEqual(0);

    // Withdrawal records in DB must match exactly the number of successes
    const history = await walletService.getWithdrawalHistory(wallet.id, 100, 0);
    expect(history.total).toBe(successes);
  });

  // Test 6: markProcessing CAS — only 1 winner under 10 concurrent calls
  it('should allow only one processor to win markProcessing CAS', async () => {
    const wallet = await walletService.createWallet(USER_1);
    await walletService.fundWallet(wallet.id, 10, 'usdc');

    const result = await walletService.withdraw(USER_1, wallet.id, '1', VALID_DEST);

    // 10 concurrent markProcessing attempts on the same withdrawal
    const casResults = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        withdrawalRepo.markProcessing(result.withdrawalId),
      ),
    );

    const wins = casResults.filter(
      r => r.status === 'fulfilled' && r.value === true,
    ).length;

    // Exactly one wins: first one transitions queued → processing, rest find status != queued
    expect(wins).toBe(1);
  });

  // Test 7: Full lifecycle — queued → processing → completed with txHash, double-complete rejected
  it('should transition through full withdrawal lifecycle and reject double-complete', async () => {
    const wallet = await walletService.createWallet(USER_1);
    await walletService.fundWallet(wallet.id, 10, 'usdc');

    const result = await walletService.withdraw(USER_1, wallet.id, '1', VALID_DEST);

    // Initial state: queued
    const w0 = await withdrawalRepo.findById(result.withdrawalId);
    expect(w0!.status).toBe('queued');

    // queued → processing
    const processed = await withdrawalRepo.markProcessing(result.withdrawalId);
    expect(processed).toBe(true);
    const w1 = await withdrawalRepo.findById(result.withdrawalId);
    expect(w1!.status).toBe('processing');

    // processing → completed with txHash
    const completed = await withdrawalRepo.markCompleted(result.withdrawalId, '0xabc123deadbeef');
    expect(completed).toBe(true);
    const w2 = await withdrawalRepo.findById(result.withdrawalId);
    expect(w2!.status).toBe('completed');
    expect(w2!.txHash).toBe('0xabc123deadbeef');

    // Double-complete rejected: status is no longer 'processing'
    const doubleComplete = await withdrawalRepo.markCompleted(result.withdrawalId, '0xother');
    expect(doubleComplete).toBe(false);

    // Final state remains completed with original txHash
    const wFinal = await withdrawalRepo.findById(result.withdrawalId);
    expect(wFinal!.status).toBe('completed');
    expect(wFinal!.txHash).toBe('0xabc123deadbeef');
  });
});
