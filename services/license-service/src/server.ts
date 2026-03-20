import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createDbConnection } from '@agntly/shared';
import { healthRoutes } from './routes/health.js';
import { licenseRoutes } from './routes/license.js';
import { LicenseService } from './services/license-service.js';

const db = createDbConnection();
const licenseService = new LicenseService(db);

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

app.decorate('licenseService', licenseService);

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(licenseRoutes, { prefix: '/v1/license' });

const port = parseInt(process.env.LICENSE_SERVICE_PORT ?? '3009', 10);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`license-service running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
