import { generateId } from '@agntly/shared';
import type { EventBus } from '@agntly/shared';
import type { WalletRepository, WalletRow } from '../repositories/wallet-repository.js';

export class WalletService {
  constructor(
    private readonly repo: WalletRepository,
    private readonly eventBus?: EventBus,
  ) {}

  async createWallet(ownerId: string, agentId?: string): Promise<WalletRow> {
    const id = generateId('wal');
    const address = `0x${Buffer.from(id).toString('hex').padEnd(40, '0').slice(0, 40)}`;
    return this.repo.create({ ownerId, agentId, address });
  }

  async getWallet(walletId: string): Promise<WalletRow | null> {
    return this.repo.findById(walletId);
  }

  async fundWallet(
    walletId: string,
    amountUsd: number,
    method: string,
  ): Promise<{
    depositId: string;
    amountUsd: number;
    usdcAmount: string;
    status: string;
    etaSeconds: number;
  }> {
    const feeRate = method === 'card' ? 0.015 : 0.005;
    const fee = amountUsd * feeRate;
    const usdcAmount = (amountUsd - fee).toFixed(6);

    const credited = await this.repo.creditBalance(walletId, usdcAmount);
    if (!credited) {
      throw new Error('Wallet not found');
    }

    const depositId = generateId('dep');
    const etaSeconds = method === 'card' ? 30 : 86400;

    if (this.eventBus) {
      await this.eventBus.publish('wallet.funded', {
        walletId,
        depositId,
        amountUsd,
        usdcAmount,
        method,
      });
    }

    return { depositId, amountUsd, usdcAmount, status: 'confirmed', etaSeconds };
  }

  async withdraw(
    walletId: string,
    amount: string,
    destination: string,
    instant?: boolean,
  ): Promise<{
    withdrawalId: string;
    amount: string;
    destination: string;
    fee: string;
    status: string;
  }> {
    const debited = await this.repo.debitBalance(walletId, amount);
    if (!debited) {
      throw new Error('Insufficient available balance or wallet not found');
    }

    const fee = instant ? (parseFloat(amount) * 0.005).toFixed(6) : '0.000000';
    const withdrawalId = generateId('wth');
    const status = instant ? 'processing' : 'queued';

    if (this.eventBus) {
      await this.eventBus.publish('wallet.withdrawn', {
        walletId,
        withdrawalId,
        amount,
        destination,
        fee,
        instant: instant ?? false,
      });
    }

    return { withdrawalId, amount, destination, fee, status };
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
