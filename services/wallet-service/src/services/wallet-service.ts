import { generateId } from '@agntly/shared';
import type { Wallet } from '@agntly/shared';

const wallets = new Map<string, Wallet>();

export class WalletService {
  async createWallet(ownerId: string, agentId?: string): Promise<Wallet> {
    const id = generateId('wal');
    const address = `0x${Buffer.from(id).toString('hex').padEnd(40, '0').slice(0, 40)}`;
    const wallet: Wallet = { id, ownerId, agentId: agentId ?? null, address, balance: '0.000000', locked: '0.000000', chain: 'base-sepolia' };
    wallets.set(id, wallet);
    return wallet;
  }

  async getWallet(walletId: string): Promise<Wallet | null> {
    return wallets.get(walletId) ?? null;
  }

  async fundWallet(walletId: string, amountUsd: number, method: string): Promise<{ depositId: string; amountUsd: number; usdcAmount: string; status: string; etaSeconds: number }> {
    const wallet = wallets.get(walletId);
    if (!wallet) throw new Error('Wallet not found');
    const fee = method === 'card' ? amountUsd * 0.015 : amountUsd * 0.005;
    const usdcAmount = (amountUsd - fee).toFixed(6);
    const newBalance = (parseFloat(wallet.balance) + parseFloat(usdcAmount)).toFixed(6);
    wallets.set(walletId, { ...wallet, balance: newBalance });
    return { depositId: generateId('dep'), amountUsd, usdcAmount, status: 'confirmed', etaSeconds: method === 'card' ? 30 : 86400 };
  }

  async withdraw(walletId: string, amount: string, destination: string, instant?: boolean): Promise<{ withdrawalId: string; amount: string; destination: string; fee: string; status: string }> {
    const wallet = wallets.get(walletId);
    if (!wallet) throw new Error('Wallet not found');
    const available = parseFloat(wallet.balance) - parseFloat(wallet.locked);
    if (parseFloat(amount) > available) throw new Error('Insufficient available balance');
    const fee = instant ? (parseFloat(amount) * 0.005).toFixed(6) : '0.000000';
    const newBalance = (parseFloat(wallet.balance) - parseFloat(amount)).toFixed(6);
    wallets.set(walletId, { ...wallet, balance: newBalance });
    return { withdrawalId: generateId('wth'), amount, destination, fee, status: instant ? 'processing' : 'queued' };
  }

  async lockFunds(walletId: string, amount: string): Promise<boolean> {
    const wallet = wallets.get(walletId);
    if (!wallet) return false;
    const available = parseFloat(wallet.balance) - parseFloat(wallet.locked);
    if (parseFloat(amount) > available) return false;
    wallets.set(walletId, { ...wallet, balance: (parseFloat(wallet.balance) - parseFloat(amount)).toFixed(6), locked: (parseFloat(wallet.locked) + parseFloat(amount)).toFixed(6) });
    return true;
  }

  async releaseFunds(walletId: string, amount: string): Promise<void> {
    const wallet = wallets.get(walletId);
    if (!wallet) throw new Error('Wallet not found');
    wallets.set(walletId, { ...wallet, balance: (parseFloat(wallet.balance) + parseFloat(amount)).toFixed(6) });
  }
}
