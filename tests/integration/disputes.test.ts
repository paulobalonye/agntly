import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { setupTestDb, cleanTestDb, teardownTestDb } from './setup.js';
import { EscrowRepository } from '../../services/escrow-engine/src/repositories/escrow-repository.js';
import { EscrowService } from '../../services/escrow-engine/src/services/escrow-service.js';
import { DisputeService } from '../../services/escrow-engine/src/services/dispute-service.js';
import type { DbConnection } from '@agntly/shared';

// Stable UUID-format wallet IDs for use in escrow tests
const FROM_WALLET_ID = '00000000-0000-0000-0000-000000000001';
const TO_WALLET_ID = '00000000-0000-0000-0000-000000000002';

let db: DbConnection;
let escrowService: EscrowService;
let disputeService: DisputeService;
let escrowRepo: EscrowRepository;

beforeAll(async () => {
  const ctx = await setupTestDb();
  db = ctx.db;
  escrowRepo = new EscrowRepository(db);
  escrowService = new EscrowService(escrowRepo);
  disputeService = new DisputeService(escrowRepo);
});

beforeEach(async () => {
  await cleanTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

describe('Dispute resolution: full lifecycle', () => {
  it('should complete full dispute lifecycle: open → evidence → resolve (release)', async () => {
    const escrow = await escrowService.lockEscrow({
      taskId: `task-dispute-release-${Date.now()}`,
      fromWalletId: FROM_WALLET_ID,
      toWalletId: TO_WALLET_ID,
      amount: '5.000000',
      deadline: new Date(Date.now() + 60_000),
    });
    expect(escrow.state).toBe('locked');

    // Dispute the escrow
    const disputed = await escrowService.disputeEscrow(escrow.id, 'Agent delivered incorrect output');
    expect(disputed.state).toBe('disputed');

    // Submit evidence from orchestrator
    await disputeService.submitEvidence(
      escrow.id,
      'orchestrator-001',
      'Task output did not match specification: expected JSON, got plain text',
    );

    // Submit evidence from agent
    await disputeService.submitEvidence(
      escrow.id,
      'agent-search',
      'Output format was correct per the original task description v1.2',
    );

    // Resolve the dispute in favour of the agent
    await disputeService.resolveDispute(
      escrow.id,
      'release_to_agent',
      'arbitrator-001',
      'Agent output matched the specification in effect at task creation time',
    );

    const resolved = await escrowRepo.findById(escrow.id);
    expect(resolved).not.toBeNull();
    expect(resolved!.state).toBe('released');
    expect(resolved!.settledAt).not.toBeNull();
  });

  it('should complete dispute lifecycle: open → resolve (refund)', async () => {
    const escrow = await escrowService.lockEscrow({
      taskId: `task-dispute-refund-${Date.now()}`,
      fromWalletId: FROM_WALLET_ID,
      toWalletId: TO_WALLET_ID,
      amount: '3.000000',
      deadline: new Date(Date.now() + 60_000),
    });

    await escrowService.disputeEscrow(escrow.id, 'Task was never started');

    await disputeService.resolveDispute(
      escrow.id,
      'refund_to_orchestrator',
      'arbitrator-001',
      'Agent did not begin work within the allowed window',
    );

    const resolved = await escrowRepo.findById(escrow.id);
    expect(resolved).not.toBeNull();
    expect(resolved!.state).toBe('refunded');
  });

  it('should reject evidence on non-disputed escrow', async () => {
    const escrow = await escrowService.lockEscrow({
      taskId: `task-evidence-locked-${Date.now()}`,
      fromWalletId: FROM_WALLET_ID,
      toWalletId: TO_WALLET_ID,
      amount: '2.000000',
      deadline: new Date(Date.now() + 60_000),
    });
    expect(escrow.state).toBe('locked');

    await expect(
      disputeService.submitEvidence(escrow.id, 'orchestrator-001', 'Some evidence'),
    ).rejects.toThrow('not in disputed state');
  });

  it('should reject resolve on non-disputed escrow', async () => {
    const escrow = await escrowService.lockEscrow({
      taskId: `task-resolve-locked-${Date.now()}`,
      fromWalletId: FROM_WALLET_ID,
      toWalletId: TO_WALLET_ID,
      amount: '2.000000',
      deadline: new Date(Date.now() + 60_000),
    });
    expect(escrow.state).toBe('locked');

    await expect(
      disputeService.resolveDispute(
        escrow.id,
        'release_to_agent',
        'arbitrator-001',
        'Should not reach here',
      ),
    ).rejects.toThrow('not in disputed state');
  });

  it('should prevent double-resolve', async () => {
    const escrow = await escrowService.lockEscrow({
      taskId: `task-double-resolve-${Date.now()}`,
      fromWalletId: FROM_WALLET_ID,
      toWalletId: TO_WALLET_ID,
      amount: '4.000000',
      deadline: new Date(Date.now() + 60_000),
    });

    await escrowService.disputeEscrow(escrow.id, 'Disputed output quality');

    // First resolve succeeds
    await disputeService.resolveDispute(
      escrow.id,
      'release_to_agent',
      'arbitrator-001',
      'Partial delivery accepted',
    );

    // Second resolve should throw because state is no longer 'disputed'
    await expect(
      disputeService.resolveDispute(
        escrow.id,
        'refund_to_orchestrator',
        'arbitrator-001',
        'Changed mind',
      ),
    ).rejects.toThrow('not in disputed state');
  });
});
