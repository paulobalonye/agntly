import type { DbConnection } from '@agntly/shared';
export interface WalletRow {
    readonly id: string;
    readonly ownerId: string;
    readonly agentId: string | null;
    readonly address: string;
    readonly balance: string;
    readonly locked: string;
    readonly chain: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}
export declare class WalletRepository {
    private readonly db;
    constructor(db: DbConnection);
    create(data: {
        ownerId: string;
        agentId?: string;
        address: string;
        chain?: string;
    }): Promise<WalletRow>;
    findById(id: string): Promise<WalletRow | null>;
    /**
     * Lock funds: atomically move from available (balance) to reserved (locked).
     * Guard: balance >= amount (NOT balance - locked, which double-counts).
     */
    lockFunds(walletId: string, amount: string): Promise<boolean>;
    /**
     * Release locked funds to a destination wallet.
     * Verifies BOTH wallets exist before executing either UPDATE.
     * If either is missing, neither executes (no money destroyed).
     */
    releaseFunds(fromWalletId: string, toWalletId: string, grossAmount: string, netAmount: string): Promise<boolean>;
    /**
     * Refund locked funds back to available balance.
     */
    refundFunds(walletId: string, amount: string): Promise<boolean>;
    /**
     * Credit wallet balance (for funding / deposits).
     */
    creditBalance(walletId: string, amount: string): Promise<boolean>;
    /**
     * Withdraw: atomically debit balance with guard.
     */
    debitBalance(walletId: string, amount: string): Promise<boolean>;
}
//# sourceMappingURL=wallet-repository.d.ts.map