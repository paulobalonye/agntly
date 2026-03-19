import Fastify from 'fastify';
import { SERVICE_PORTS, EventBus } from '@agntly/shared';
import type { ServiceMessage } from '@agntly/shared';
import { SettlementService } from './services/settlement-service.js';

const eventBus = new EventBus('settlement-worker');
const settlementService = new SettlementService();

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

app.get('/health', async () => ({
  status: 'ok',
  service: 'settlement-worker',
  timestamp: new Date().toISOString(),
}));

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
