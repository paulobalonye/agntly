import { parseAbi, type Hex } from 'viem';
import { GasManager } from './gas-manager.js';
import { usdcToSmallest } from '@agntly/shared';

const ESCROW_CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS as `0x${string}` | undefined;

const ESCROW_ABI = parseAbi([
  'function releaseEscrow(bytes32 escrowId, bytes32 resultHash) external',
  'function refundEscrow(bytes32 escrowId) external',
  'function resolveDispute(bytes32 escrowId, address winner) external',
]);

const USDC_CONTRACT_ADDRESS = process.env.USDC_CONTRACT_ADDRESS as `0x${string}` | undefined;

const USDC_ABI = parseAbi([
  'function transfer(address to, uint256 amount) external returns (bool)',
]);

export class SettlementService {
  private readonly gasManager = new GasManager();

  async submitRelease(data: Record<string, unknown>): Promise<string | null> {
    if (!ESCROW_CONTRACT_ADDRESS || !this.gasManager.walletClient) {
      console.log('[Settlement] No contract configured — skipping on-chain settlement (dev mode)');
      return null;
    }

    const hasGas = await this.gasManager.checkGasBalance();
    if (!hasGas) throw new Error('Insufficient gas balance for settlement');

    const escrowId = data.escrowId as string;
    const resultHash = (data.resultHash as string) ?? ('0x' + '0'.repeat(64));

    const txHash = await this.gasManager.walletClient.writeContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      functionName: 'releaseEscrow',
      args: [escrowId as Hex, resultHash as Hex],
      nonce: await this.gasManager.getNextNonce(),
    });

    console.log(`[Settlement] Release tx submitted: ${txHash}`);

    const receipt = await this.gasManager.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === 'reverted') {
      // Nonce fetched from chain on each tx — no reset needed
      throw new Error(`Release tx reverted: ${txHash}`);
    }

    console.log(`[Settlement] Release confirmed in block ${receipt.blockNumber}`);
    return txHash;
  }

  async submitRefund(data: Record<string, unknown>): Promise<string | null> {
    if (!ESCROW_CONTRACT_ADDRESS || !this.gasManager.walletClient) {
      console.log('[Settlement] No contract configured — skipping (dev mode)');
      return null;
    }

    const hasGas = await this.gasManager.checkGasBalance();
    if (!hasGas) throw new Error('Insufficient gas balance for settlement');

    const escrowId = data.escrowId as string;

    const txHash = await this.gasManager.walletClient.writeContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      functionName: 'refundEscrow',
      args: [escrowId as Hex],
      nonce: await this.gasManager.getNextNonce(),
    });

    const receipt = await this.gasManager.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === 'reverted') {
      // Nonce fetched from chain on each tx — no reset needed
      throw new Error(`Refund tx reverted: ${txHash}`);
    }

    return txHash;
  }

  async submitDisputeResolution(data: Record<string, unknown>): Promise<string | null> {
    if (!ESCROW_CONTRACT_ADDRESS || !this.gasManager.walletClient) {
      console.log('[Settlement] No contract configured — skipping (dev mode)');
      return null;
    }

    const hasGas = await this.gasManager.checkGasBalance();
    if (!hasGas) throw new Error('Insufficient gas balance for settlement');

    const escrowId = data.escrowId as string;
    const decision = data.decision as string;

    // The winner address must be a valid Ethereum address, not a wallet UUID.
    // The event publisher must include agentAddress / orchestratorAddress fields.
    const winnerAddress = decision === 'release_to_agent'
      ? (data.agentAddress as string)
      : (data.orchestratorAddress as string);

    if (!winnerAddress || !winnerAddress.startsWith('0x') || winnerAddress.length !== 42) {
      throw new Error(
        `Invalid winner address for dispute resolution: ${winnerAddress}. ` +
        'The escrow.dispute_resolved event must include agentAddress and orchestratorAddress fields with valid Ethereum addresses.',
      );
    }

    const txHash = await this.gasManager.walletClient.writeContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      functionName: 'resolveDispute',
      args: [escrowId as Hex, winnerAddress as `0x${string}`],
      nonce: await this.gasManager.getNextNonce(),
    });

    const receipt = await this.gasManager.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === 'reverted') {
      // Nonce fetched from chain on each tx — no reset needed
      throw new Error(`Dispute resolution tx reverted: ${txHash}`);
    }

    return txHash;
  }

  async submitWithdrawal(data: Record<string, unknown>): Promise<string | null> {
    if (!USDC_CONTRACT_ADDRESS || !this.gasManager.walletClient) {
      console.log('[Settlement] No USDC contract configured — skipping withdrawal (dev mode)');
      return null;
    }

    const hasGas = await this.gasManager.checkGasBalance();
    if (!hasGas) throw new Error('Insufficient gas balance for withdrawal');

    const destination = data.destination as string;
    const amount = data.amount as string;

    // Convert "5.000000" to smallest unit (6 decimals) using shared utility (avoids floating-point errors)
    const amountSmallest = usdcToSmallest(amount);

    const txHash = await this.gasManager.walletClient.writeContract({
      address: USDC_CONTRACT_ADDRESS,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [destination as `0x${string}`, amountSmallest],
      nonce: await this.gasManager.getNextNonce(),
    });

    console.log(`[Settlement] Withdrawal tx submitted: ${txHash} → ${destination} (${amount} USDC)`);

    const receipt = await this.gasManager.publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status === 'reverted') {
      // Nonce fetched from chain on each tx — no reset needed
      throw new Error(`Withdrawal tx reverted: ${txHash}`);
    }

    console.log(`[Settlement] Withdrawal confirmed in block ${receipt.blockNumber}`);
    return txHash;
  }
}
