import { sql } from 'drizzle-orm';
import type { DbConnection } from '@agntly/shared';
import { ColumnClient } from './column/column-client.js';
import type { KycService } from './kyc-service.js';

export interface BankAccount {
  readonly id: string;
  readonly userId: string;
  readonly columnAccountId: string | null;
  readonly accountNumberMasked: string | null;
  readonly routingNumber: string | null;
  readonly bankName: string;
  readonly accountType: string;
  readonly currency: string;
  readonly status: string;
}

export interface FiatTransfer {
  readonly id: string;
  readonly userId: string;
  readonly direction: string;
  readonly amountUsd: string;
  readonly usdcAmount: string | null;
  readonly columnTransferId: string | null;
  readonly transferType: string;
  readonly status: string;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

function mapBankAccount(row: Record<string, unknown>): BankAccount {
  return {
    id: String(row.id ?? ''),
    userId: String(row.user_id ?? ''),
    columnAccountId: row.column_account_id ? String(row.column_account_id) : null,
    accountNumberMasked: row.account_number_masked ? String(row.account_number_masked) : null,
    routingNumber: row.routing_number ? String(row.routing_number) : null,
    bankName: String(row.bank_name ?? 'Column'),
    accountType: String(row.account_type ?? 'checking'),
    currency: String(row.currency ?? 'USD'),
    status: String(row.status ?? 'active'),
  };
}

function mapTransfer(row: Record<string, unknown>): FiatTransfer {
  return {
    id: String(row.id ?? ''),
    userId: String(row.user_id ?? ''),
    direction: String(row.direction ?? ''),
    amountUsd: String(row.amount_usd ?? '0'),
    usdcAmount: row.usdc_amount ? String(row.usdc_amount) : null,
    columnTransferId: row.column_transfer_id ? String(row.column_transfer_id) : null,
    transferType: String(row.transfer_type ?? 'ach'),
    status: String(row.status ?? 'pending'),
    createdAt: String(row.created_at ?? ''),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

export class FiatService {
  private readonly column: ColumnClient;

  constructor(
    private readonly db: DbConnection,
    private readonly kycService: KycService,
  ) {
    this.column = new ColumnClient();
  }

  /**
   * Create a bank account for a verified user.
   */
  async createBankAccount(userId: string): Promise<BankAccount> {
    // Check KYC
    const kyc = await this.kycService.getKycStatus(userId);
    if (!kyc || kyc.status !== 'verified') {
      throw new Error('KYC verification required before creating a bank account');
    }

    // Check if already has an account
    const existing = await this.getBankAccount(userId);
    if (existing) return existing;

    // Create Column account
    const columnAccount = await this.column.createAccount(
      userId,
      kyc.fullName ?? 'Agent Owner',
      kyc.country ?? 'US',
    );

    // Store in DB
    await this.db.execute(sql`
      INSERT INTO bank_accounts (user_id, column_account_id, account_number_masked, routing_number)
      VALUES (${userId}::uuid, ${columnAccount.id}, ${columnAccount.accountNumberMasked}, ${columnAccount.routingNumber})
    `);

    const account = await this.getBankAccount(userId);
    if (!account) throw new Error('Bank account creation failed');
    return account;
  }

  async getBankAccount(userId: string): Promise<BankAccount | null> {
    const result = await this.db.execute(sql`
      SELECT * FROM bank_accounts WHERE user_id = ${userId}::uuid AND status = 'active' LIMIT 1
    `);
    if (!result.rows || result.rows.length === 0) return null;
    return mapBankAccount(result.rows[0] as Record<string, unknown>);
  }

  /**
   * Withdraw USD from platform to builder's bank account.
   * Deducts USDC from wallet, converts to USD, sends via ACH.
   */
  async withdrawUsd(userId: string, amountUsd: number): Promise<FiatTransfer> {
    if (amountUsd < 10) {
      throw new Error('Minimum withdrawal is $10');
    }

    // Check KYC
    const verified = await this.kycService.isVerified(userId);
    if (!verified) throw new Error('KYC verification required for fiat withdrawals');

    // Check bank account exists
    const bankAccount = await this.getBankAccount(userId);
    if (!bankAccount || !bankAccount.columnAccountId) {
      throw new Error('No bank account linked. Create one first.');
    }

    // Convert USD to USDC amount (1:1 for now)
    const usdcAmount = amountUsd.toFixed(6);

    // Initiate Column ACH transfer
    const transfer = await this.column.initiateACHTransfer(
      'platform_fbo_account', // Platform's FBO account
      bankAccount.columnAccountId,
      amountUsd,
      `Agntly earnings withdrawal`,
    );

    // Record transfer
    await this.db.execute(sql`
      INSERT INTO fiat_transfers (user_id, bank_account_id, direction, amount_usd, usdc_amount, column_transfer_id, transfer_type, status)
      VALUES (${userId}::uuid, ${bankAccount.id}::uuid, 'withdrawal', ${amountUsd}, ${usdcAmount}, ${transfer.id}, 'ach', 'pending')
    `);

    const result = await this.db.execute(sql`
      SELECT * FROM fiat_transfers WHERE column_transfer_id = ${transfer.id} LIMIT 1
    `);

    return mapTransfer((result.rows[0] ?? {}) as Record<string, unknown>);
  }

  /**
   * Get fiat transfer history for a user.
   */
  async getTransferHistory(userId: string, limit = 20): Promise<FiatTransfer[]> {
    const result = await this.db.execute(sql`
      SELECT * FROM fiat_transfers WHERE user_id = ${userId}::uuid
      ORDER BY created_at DESC LIMIT ${limit}
    `);
    return (result.rows as Record<string, unknown>[]).map(mapTransfer);
  }

  /**
   * Admin: get all fiat transfers.
   */
  async getAllTransfers(limit = 50, offset = 0): Promise<{ transfers: FiatTransfer[]; total: number }> {
    const countResult = await this.db.execute(sql`SELECT COUNT(*)::int AS total FROM fiat_transfers`);
    const total = (countResult.rows[0] as { total: number })?.total ?? 0;

    const result = await this.db.execute(sql`
      SELECT * FROM fiat_transfers ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `);
    return { transfers: (result.rows as Record<string, unknown>[]).map(mapTransfer), total };
  }

  /**
   * Admin: get fiat stats.
   */
  async getStats(): Promise<{ totalDeposits: string; totalWithdrawals: string; pendingTransfers: number }> {
    const result = await this.db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN direction = 'deposit' THEN amount_usd ELSE 0 END), 0)::text AS total_deposits,
        COALESCE(SUM(CASE WHEN direction = 'withdrawal' THEN amount_usd ELSE 0 END), 0)::text AS total_withdrawals,
        COUNT(CASE WHEN status = 'pending' THEN 1 END)::int AS pending_transfers
      FROM fiat_transfers
    `);
    const row = (result.rows[0] ?? {}) as Record<string, unknown>;
    return {
      totalDeposits: String(row.total_deposits ?? '0'),
      totalWithdrawals: String(row.total_withdrawals ?? '0'),
      pendingTransfers: Number(row.pending_transfers ?? 0),
    };
  }
}
