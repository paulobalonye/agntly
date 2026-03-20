import pg from 'pg';
import { generateId } from '@agntly/shared';
import type { EventBus } from '@agntly/shared';
import type { WalletRepository, WalletRow } from '../repositories/wallet-repository.js';
import type { WithdrawalRepository, WithdrawalRow } from '../repositories/withdrawal-repository.js';

export class WalletService {
  constructor(
    private readonly repo: WalletRepository,
    private readonly withdrawalRepo: WithdrawalRepository,
    private readonly pool: pg.Pool,
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

  async getWalletByOwner(ownerId: string): Promise<WalletRow | null> {
    return this.repo.findByOwner(ownerId);
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
    userId: string,
    walletId: string,
    amount: string,
    destination: string,
  ): Promise<{
    withdrawalId: string;
    amount: string;
    destination: string;
    fee: string;
    status: string;
  }> {
    // Verify wallet exists and belongs to the caller
    const wallet = await this.repo.findById(walletId);
    if (!wallet) throw new Error('Wallet not found');
    if (wallet.ownerId !== userId) throw new Error('Wallet does not belong to user');

    // Normalize amount to 6 decimal places
    const normalizedAmount = parseFloat(amount).toFixed(6);
    const fee = '0.000000';

    // Atomic transaction: debit balance + create withdrawal record
    const client = await this.pool.connect();
    let withdrawalId: string;
    try {
      await client.query('BEGIN');

      // Debit balance with guard
      const debitResult = await client.query(
        `UPDATE wallets SET balance = balance - $2::numeric, updated_at = NOW()
         WHERE id = $1::uuid AND balance >= $2::numeric
         RETURNING id`,
        [walletId, normalizedAmount],
      );

      if (debitResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new Error('Insufficient available balance');
      }

      // Create withdrawal record
      const insertResult = await client.query(
        `INSERT INTO withdrawals (wallet_id, amount, destination, fee, status)
         VALUES ($1::uuid, $2::numeric, $3, $4::numeric, 'queued')
         RETURNING id`,
        [walletId, normalizedAmount, destination, fee],
      );

      withdrawalId = insertResult.rows[0].id;
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Publish event (outside transaction — best effort)
    if (this.eventBus) {
      await this.eventBus.publish('wallet.withdrawn', {
        withdrawalId,
        walletId,
        amount: normalizedAmount,
        destination,
        fee,
      });
    }

    return {
      withdrawalId,
      amount: normalizedAmount,
      destination,
      fee,
      status: 'queued',
    };
  }

  async getWithdrawalHistory(
    walletId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ withdrawals: readonly WithdrawalRow[]; total: number; limit: number; offset: number }> {
    const { rows, total } = await this.withdrawalRepo.findByWalletId(walletId, limit, offset);
    return { withdrawals: rows, total, limit, offset };
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
