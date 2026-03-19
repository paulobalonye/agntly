import { generateId, calculateFee } from '@agntly/shared';
import type { Escrow } from '@agntly/shared';

const escrows = new Map<string, Escrow>();

export class EscrowService {
  async lockEscrow(params: { taskId: string; fromWalletId: string; toWalletId: string; amount: string }): Promise<Escrow> {
    const { fee } = calculateFee(params.amount);
    const id = generateId('esc');
    const escrow: Escrow = {
      id, taskId: params.taskId, fromWalletId: params.fromWalletId, toWalletId: params.toWalletId,
      amount: params.amount, fee, state: 'locked',
      txHash: `0x${Buffer.from(id).toString('hex').padEnd(64, '0')}`,
      createdAt: new Date(), settledAt: null,
    };
    escrows.set(id, escrow);
    return escrow;
  }

  async releaseEscrow(escrowId: string): Promise<Escrow> {
    const escrow = escrows.get(escrowId);
    if (!escrow) throw new Error('Escrow not found');
    if (escrow.state !== 'locked') throw new Error(`Cannot release escrow in state: ${escrow.state}`);
    const released: Escrow = { ...escrow, state: 'released', settledAt: new Date() };
    escrows.set(escrowId, released);
    return released;
  }

  async refundEscrow(escrowId: string): Promise<Escrow> {
    const escrow = escrows.get(escrowId);
    if (!escrow) throw new Error('Escrow not found');
    if (escrow.state !== 'locked') throw new Error(`Cannot refund escrow in state: ${escrow.state}`);
    const refunded: Escrow = { ...escrow, state: 'refunded', settledAt: new Date() };
    escrows.set(escrowId, refunded);
    return refunded;
  }

  async disputeEscrow(escrowId: string, reason: string): Promise<Escrow> {
    const escrow = escrows.get(escrowId);
    if (!escrow) throw new Error('Escrow not found');
    if (escrow.state !== 'locked') throw new Error(`Cannot dispute escrow in state: ${escrow.state}`);
    const disputed: Escrow = { ...escrow, state: 'disputed' };
    escrows.set(escrowId, disputed);
    return disputed;
  }

  async getEscrow(escrowId: string): Promise<Escrow | null> {
    return escrows.get(escrowId) ?? null;
  }
}
