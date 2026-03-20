import Fastify from 'fastify';
import cors from '@fastify/cors';
import { SERVICE_PORTS, createDbConnection } from '@agntly/shared';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { apiKeyRoutes } from './routes/api-keys.js';
import { adminUserRoutes } from './routes/admin.js';
import { AuthService } from './services/auth-service.js';
import { ApiKeyService } from './services/api-key-service.js';
import { MagicLinkService } from './services/magic-link-service.js';
import { ResendClient } from './services/resend-client.js';

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

await app.register(cors, { origin: true });

const db = createDbConnection();
const authService = new AuthService(db);
const apiKeyService = new ApiKeyService(db);
const resendClient = new ResendClient();
const magicLinkService = new MagicLinkService(authService, resendClient, db);

app.decorate('authService', authService);
app.decorate('apiKeyService', apiKeyService);
app.decorate('magicLinkService', magicLinkService);

await app.register(healthRoutes);
await app.register(authRoutes, { prefix: '/v1/auth' });
await app.register(apiKeyRoutes, { prefix: '/v1/api-keys' });
await app.register(adminUserRoutes, { prefix: '/v1/admin' });

const port = SERVICE_PORTS.auth;
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`auth-service running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
