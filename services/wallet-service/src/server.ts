import Fastify from 'fastify';
import cors from '@fastify/cors';
import { SERVICE_PORTS, createDbConnection, createPool, EventBus } from '@agntly/shared';
import { healthRoutes } from './routes/health.js';
import { walletRoutes } from './routes/wallets.js';
import { adminWalletRoutes } from './routes/admin.js';
import { kycRoutes } from './routes/kyc.js';
import { fiatRoutes } from './routes/fiat.js';
import { WalletRepository } from './repositories/wallet-repository.js';
import { WithdrawalRepository } from './repositories/withdrawal-repository.js';
import { WalletService } from './services/wallet-service.js';
import { KycService } from './services/kyc-service.js';
import { FiatService } from './services/fiat-service.js';

const db = createDbConnection();
const eventBus = new EventBus('wallet-service');
const walletRepo = new WalletRepository(db);
const pool = createPool();
const withdrawalRepo = new WithdrawalRepository(db);
const walletService = new WalletService(walletRepo, withdrawalRepo, pool, eventBus);
const kycService = new KycService(db);
const fiatService = new FiatService(db, kycService);

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

app.decorate('walletService', walletService);
app.decorate('kycService', kycService);
app.decorate('fiatService', fiatService);

// Extract x-user-id header into request.userId for all routes
app.addHook('preHandler', async (request) => {
  const userId = request.headers['x-user-id'];
  if (typeof userId === 'string' && userId.length > 0) {
    (request as any).userId = userId;
  }
});

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(walletRoutes, { prefix: '/v1/wallets' });
await app.register(kycRoutes, { prefix: '/v1/kyc' });
await app.register(fiatRoutes, { prefix: '/v1/fiat' });
await app.register(adminWalletRoutes, { prefix: '/v1/admin' });

const port = SERVICE_PORTS.wallet;
const host = process.env.HOST ?? '0.0.0.0';

try {
  // Initialize treasury wallet on startup
  const treasuryId = await walletService.getTreasuryWalletId();
  app.log.info(`Treasury wallet: ${treasuryId}`);

  await app.listen({ port, host });
  app.log.info(`wallet-service running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
