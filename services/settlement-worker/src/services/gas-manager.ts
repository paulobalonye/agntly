// TODO: SECURITY — Nonce management uses in-memory state. On crash-restart, nonces may
// desync from chain state. For production, always fetch nonce from chain before each tx,
// or use Redis-based nonce locking for multi-instance coordination.
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const RPC_URL = process.env.BASE_RPC_URL ?? 'https://sepolia.base.org';
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const MIN_ETH_BALANCE = parseEther('0.01');

export class GasManager {
  private nonce: number | null = null;
  private readonly chain = baseSepolia;

  readonly publicClient = createPublicClient({
    chain: this.chain,
    transport: http(RPC_URL),
  });

  readonly walletClient = RELAYER_PRIVATE_KEY
    ? createWalletClient({
        account: privateKeyToAccount(RELAYER_PRIVATE_KEY as `0x${string}`),
        chain: this.chain,
        transport: http(RPC_URL),
      })
    : null;

  async getNextNonce(): Promise<number> {
    if (this.nonce === null || this.nonce % 20 === 0) {
      const account = this.walletClient?.account;
      if (!account) throw new Error('No relayer wallet configured');
      this.nonce = await this.publicClient.getTransactionCount({ address: account.address });
    }
    return this.nonce++;
  }

  async checkGasBalance(): Promise<boolean> {
    const account = this.walletClient?.account;
    if (!account) return false;
    const balance = await this.publicClient.getBalance({ address: account.address });
    if (balance < MIN_ETH_BALANCE) {
      console.error(`[GasManager] ALERT: Relayer ETH balance low: ${balance}. Min required: ${MIN_ETH_BALANCE}`);
      return false;
    }
    return true;
  }

  resetNonce(): void {
    this.nonce = null;
  }
}
