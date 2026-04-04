import { generateId, calculateFee, DEFAULT_TASK_TIMEOUT_MS } from '@agntly/shared';
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
    deadline?: Date;
  }): Promise<EscrowRow> {
    // Verify sender wallet has sufficient balance (direct DB query — shared database)
    const balanceResult = await this.repo.getWalletBalance(params.fromWalletId);
    if (balanceResult !== null) {
      const balance = parseFloat(balanceResult);
      const amount = parseFloat(params.amount);
      if (amount > balance) {
        throw new Error(`Insufficient balance: need ${params.amount} but wallet has ${balanceResult}`);
      }
    }

    const { fee } = calculateFee(params.amount);
    const txHash = `0x${Buffer.from(generateId('esc')).toString('hex').padEnd(64, '0').slice(0, 64)}`;

    const deadline = params.deadline ?? new Date(Date.now() + DEFAULT_TASK_TIMEOUT_MS);

    const escrow = await this.repo.create({
      taskId: params.taskId,
      fromWalletId: params.fromWalletId,
      toWalletId: params.toWalletId,
      amount: params.amount,
      fee,
      txHash,
      deadline,
    });

    await this.repo.addAuditEntry({
      escrowId: escrow.id,
      action: 'locked',
      actor: 'system',
      details: `Escrow locked for task ${params.taskId}`,
    });

    if (this.eventBus) {
      await this.eventBus.publish('escrow.locked', {
        escrowId: escrow.id,
        taskId: escrow.taskId,
        fromWalletId: escrow.fromWalletId,
        toWalletId: escrow.toWalletId,
        amount: escrow.amount,
        fee: escrow.fee,
      });
    }

    return escrow;
  }

  async releaseEscrow(escrowId: string, resultHash?: string): Promise<EscrowRow> {
    const escrow = await this.repo.transition(
      escrowId,
      'locked',
      'released',
      resultHash !== undefined ? { resultHash } : undefined,
    );

    if (!escrow) {
      const current = await this.repo.findById(escrowId);
      console.error(`[EscrowService] Cannot release escrow ${escrowId}: ${current ? `current state: ${current.state}` : 'not found'}`);
      throw new Error('Escrow cannot be released');
    }

    await this.repo.addAuditEntry({
      escrowId: escrow.id,
      action: 'released',
      actor: 'system',
      details: resultHash ? `Released with result hash ${resultHash}` : 'Released',
    });

    if (this.eventBus) {
      await this.eventBus.publish('escrow.released', {
        escrowId: escrow.id,
        taskId: escrow.taskId,
        fromWalletId: escrow.fromWalletId,
        toWalletId: escrow.toWalletId,
        amount: escrow.amount,
        fee: escrow.fee,
        resultHash: escrow.resultHash ?? null,
      });
    }

    return escrow;
  }

  async refundEscrow(escrowId: string): Promise<EscrowRow> {
    const escrow = await this.repo.transition(escrowId, 'locked', 'refunded');

    if (!escrow) {
      const current = await this.repo.findById(escrowId);
      console.error(`[EscrowService] Cannot refund escrow ${escrowId}: ${current ? `current state: ${current.state}` : 'not found'}`);
      throw new Error('Escrow cannot be refunded');
    }

    await this.repo.addAuditEntry({
      escrowId: escrow.id,
      action: 'refunded',
      actor: 'system',
      details: 'Escrow refunded to sender',
    });

    if (this.eventBus) {
      await this.eventBus.publish('escrow.refunded', {
        escrowId: escrow.id,
        taskId: escrow.taskId,
        fromWalletId: escrow.fromWalletId,
        amount: escrow.amount,
      });
    }

    return escrow;
  }

  async disputeEscrow(escrowId: string, reason: string): Promise<EscrowRow> {
    const escrow = await this.repo.transition(escrowId, 'locked', 'disputed', {
      disputeReason: reason,
    });

    if (!escrow) {
      const current = await this.repo.findById(escrowId);
      console.error(`[EscrowService] Cannot dispute escrow ${escrowId}: ${current ? `current state: ${current.state}` : 'not found'}`);
      throw new Error('Escrow cannot be disputed');
    }

    await this.repo.addAuditEntry({
      escrowId: escrow.id,
      action: 'disputed',
      actor: 'system',
      details: `Dispute raised: ${reason}`,
    });

    return escrow;
  }

  async getEscrow(escrowId: string): Promise<EscrowRow | null> {
    return this.repo.findById(escrowId);
  }

  async getEscrowByTaskId(taskId: string): Promise<EscrowRow | null> {
    return this.repo.findByTaskId(taskId);
  }
}
