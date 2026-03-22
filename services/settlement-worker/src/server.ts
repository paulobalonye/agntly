import Fastify from 'fastify';
import { SERVICE_PORTS, EventBus } from '@agntly/shared';
import type { ServiceMessage } from '@agntly/shared';
import { SettlementService } from './services/settlement-service.js';

const eventBus = new EventBus('settlement-worker');
const settlementService = new SettlementService();

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

app.get('/health', async () => {
  const hasContract = !!process.env.ESCROW_CONTRACT_ADDRESS;
  const hasRelayer = !!process.env.RELAYER_PRIVATE_KEY;
  const hasUsdc = !!process.env.USDC_CONTRACT_ADDRESS;

  let gasBalance: string | null = null;
  let relayerAddress: string | null = null;
  try {
    if (hasRelayer) {
      const { privateKeyToAccount } = await import('viem/accounts');
      const account = privateKeyToAccount(process.env.RELAYER_PRIVATE_KEY as `0x${string}`);
      relayerAddress = account.address;
      const { createPublicClient, http, formatEther } = await import('viem');
      const { baseSepolia } = await import('viem/chains');
      const client = createPublicClient({ chain: baseSepolia, transport: http(process.env.BASE_RPC_URL ?? 'https://sepolia.base.org') });
      const balance = await client.getBalance({ address: account.address });
      gasBalance = formatEther(balance);
    }
  } catch { /* ignore */ }

  return {
    status: 'ok',
    service: 'settlement-worker',
    onChain: {
      enabled: hasContract && hasRelayer,
      escrowContract: process.env.ESCROW_CONTRACT_ADDRESS ?? null,
      usdcContract: process.env.USDC_CONTRACT_ADDRESS ?? null,
      relayer: relayerAddress,
      gasBalance: gasBalance ? `${gasBalance} ETH` : null,
      chain: 'base-sepolia',
    },
    timestamp: new Date().toISOString(),
  };
});

async function startEventLoop() {
  await eventBus.subscribe(
    async (message: ServiceMessage) => {
      app.log.info({ eventType: message.type, eventId: message.id }, 'Processing settlement event');
      try {
        if (message.type === 'escrow.released') {
          await settlementService.submitRelease(message.data);
        } else if (message.type === 'escrow.refunded') {
          await settlementService.submitRefund(message.data);
        } else if (message.type === 'escrow.dispute_resolved') {
          await settlementService.submitDisputeResolution(message.data);
        } else if (message.type === 'wallet.withdrawn') {
          await settlementService.submitWithdrawal(message.data);
        }
      } catch (err) {
        app.log.error({ err, eventId: message.id }, 'Settlement processing failed');
      }
    },
    ['escrow.released', 'escrow.refunded', 'escrow.dispute_resolved', 'wallet.withdrawn'],
  );
}

const port = SERVICE_PORTS.settlement;
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`settlement-worker running on ${host}:${port}`);
  await startEventLoop();
  app.log.info('Settlement event loop started');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
