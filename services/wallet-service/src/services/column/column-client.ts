/**
 * Column Banking API Client
 * Docs: https://column.com/docs
 *
 * Handles programmatic bank account creation, ACH transfers, and balance queries.
 * Stubbed when COLUMN_API_KEY is not set (sandbox/dev mode).
 */

const COLUMN_API_KEY = process.env.COLUMN_API_KEY ?? '';
const COLUMN_BASE_URL = process.env.COLUMN_BASE_URL ?? 'https://api.column.com';
const COLUMN_ENV = process.env.COLUMN_ENV ?? 'sandbox';

interface ColumnAccount {
  id: string;
  accountNumber: string;
  accountNumberMasked: string;
  routingNumber: string;
  status: string;
  currency: string;
  balance: number;
}

interface ColumnTransfer {
  id: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  createdAt: string;
}

export class ColumnClient {
  private readonly isConfigured: boolean;

  constructor() {
    this.isConfigured = !!COLUMN_API_KEY;
    if (!this.isConfigured) {
      console.log('[Column] No API key configured. Running in stub mode.');
    }
  }

  /**
   * Create a bank account for a user.
   */
  async createAccount(userId: string, fullName: string, country: string): Promise<ColumnAccount> {
    if (!this.isConfigured) {
      // Stub: return a fake account
      const fakeId = `col_acct_${userId.slice(0, 8)}`;
      return {
        id: fakeId,
        accountNumber: `****${Math.random().toString().slice(2, 6)}`,
        accountNumberMasked: `****${Math.random().toString().slice(2, 6)}`,
        routingNumber: '021000021',
        status: 'active',
        currency: 'USD',
        balance: 0,
      };
    }

    const res = await fetch(`${COLUMN_BASE_URL}/accounts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COLUMN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'checking',
        currency: 'USD',
        description: `Agntly agent account for ${fullName}`,
        metadata: { agntly_user_id: userId, country },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Column account creation failed: ${err}`);
    }

    const data = await res.json() as Record<string, unknown>;
    return {
      id: String(data.id),
      accountNumber: String(data.account_number ?? ''),
      accountNumberMasked: String(data.account_number_masked ?? data.account_number ?? '').replace(/.(?=.{4})/g, '*'),
      routingNumber: String(data.routing_number ?? ''),
      status: String(data.status ?? 'active'),
      currency: 'USD',
      balance: 0,
    };
  }

  /**
   * Get account balance.
   */
  async getBalance(columnAccountId: string): Promise<number> {
    if (!this.isConfigured) {
      return 0;
    }

    const res = await fetch(`${COLUMN_BASE_URL}/accounts/${columnAccountId}/balances`, {
      headers: { 'Authorization': `Bearer ${COLUMN_API_KEY}` },
    });

    if (!res.ok) return 0;
    const data = await res.json() as { available_balance?: number };
    return (data.available_balance ?? 0) / 100; // Column uses cents
  }

  /**
   * Initiate ACH withdrawal (platform to builder's bank).
   */
  async initiateACHTransfer(
    fromAccountId: string,
    toAccountId: string,
    amountUsd: number,
    description: string,
  ): Promise<ColumnTransfer> {
    if (!this.isConfigured) {
      return {
        id: `col_txn_${Date.now()}`,
        amount: amountUsd,
        currency: 'USD',
        status: 'pending',
        type: 'ach',
        createdAt: new Date().toISOString(),
      };
    }

    const res = await fetch(`${COLUMN_BASE_URL}/transfers/ach`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${COLUMN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amountUsd * 100), // Column uses cents
        currency: 'USD',
        counterparty_id: toAccountId,
        description,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Column ACH transfer failed: ${err}`);
    }

    const data = await res.json() as Record<string, unknown>;
    return {
      id: String(data.id),
      amount: amountUsd,
      currency: 'USD',
      status: String(data.status ?? 'pending'),
      type: 'ach',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get transfer status.
   */
  async getTransferStatus(transferId: string): Promise<string> {
    if (!this.isConfigured) return 'completed';

    const res = await fetch(`${COLUMN_BASE_URL}/transfers/${transferId}`, {
      headers: { 'Authorization': `Bearer ${COLUMN_API_KEY}` },
    });

    if (!res.ok) return 'unknown';
    const data = await res.json() as { status?: string };
    return data.status ?? 'unknown';
  }

  get configured(): boolean {
    return this.isConfigured;
  }
}
