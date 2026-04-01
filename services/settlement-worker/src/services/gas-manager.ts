import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Base mainnet uses BASE_RPC_URL; Base Sepolia uses BASE_SEPOLIA_RPC.
const RPC_URL = IS_PRODUCTION
  ? (process.env.BASE_RPC_URL ?? 'https://mainnet.base.org')
  : (process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org');

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

// Mainnet gas costs more — require a larger cushion.
const MIN_ETH_BALANCE = IS_PRODUCTION
  ? parseEther('0.005')   // ~$15 buffer at current ETH prices
  : parseEther('0.0005'); // Base Sepolia gas is essentially free

const activeChain = IS_PRODUCTION ? base : baseSepolia;

export class GasManager {
  private readonly chain = activeChain;

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
   * Always fetch nonce from chain — safe for single-instance deployment and
   * avoids desync after a crash-restart.
   */
  async getNextNonce(): Promise<number> {
    const account = this.walletClient?.account;
    if (!account) throw new Error('No relayer wallet configured');
    return this.publicClient.getTransactionCount({
      address: account.address,
      blockTag: 'pending',
    });
  }

  async checkGasBalance(): Promise<boolean> {
    const account = this.walletClient?.account;
    if (!account) return false;
    const balance = await this.publicClient.getBalance({ address: account.address });
    if (balance < MIN_ETH_BALANCE) {
      console.error(
        `[GasManager] ALERT: Relayer ETH balance low on ${IS_PRODUCTION ? 'Base mainnet' : 'Base Sepolia'}: ` +
        `${balance} wei. Minimum required: ${MIN_ETH_BALANCE} wei`,
      );
      return false;
    }
    return true;
  }
}
