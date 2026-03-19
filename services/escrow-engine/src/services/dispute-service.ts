import type { EventBus } from '@agntly/shared';
import type { DisputeDecision } from '@agntly/shared';
import type { EscrowRepository } from '../repositories/escrow-repository.js';

export class DisputeService {
  constructor(
    private readonly escrowRepo: EscrowRepository,
    private readonly eventBus?: EventBus,
  ) {}

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
