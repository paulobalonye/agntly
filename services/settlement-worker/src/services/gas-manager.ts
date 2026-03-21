import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const RPC_URL = process.env.BASE_RPC_URL ?? 'https://sepolia.base.org';
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const MIN_ETH_BALANCE = parseEther('0.01');

export class GasManager {
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

  /**
   * Always fetch nonce from chain. This avoids desync on crash-restart
   * and is safe for single-instance deployment.
   */
  async getNextNonce(): Promise<number> {
    const account = this.walletClient?.account;
    if (!account) throw new Error('No relayer wallet configured');
    const nonce = await this.publicClient.getTransactionCount({
      address: account.address,
      blockTag: 'pending',
    });
    return nonce;
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
}
