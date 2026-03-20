import Fastify from 'fastify';
import cors from '@fastify/cors';
import proxy from '@fastify/http-proxy';
import rateLimit from '@fastify/rate-limit';
import { GATEWAY_PORT, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from './config.js';
import { ROUTE_TABLE } from './routes.js';
import { authMiddleware } from './middleware/auth.js';

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
});

// CORS — restrict to known origins using a callback to prevent reflection
const allowedOrigins = new Set(
  process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) ?? ['http://localhost:3100', 'http://localhost:3000'],
);
await app.register(cors, {
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server, curl)
    if (!origin || allowedOrigins.has(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
});

// Rate limiting — registered globally before proxies so all routes are covered
// TODO: SECURITY — Auth endpoints (/v1/auth/*) should have a stricter rate limit (e.g. 5 req/15min).
// The MagicLinkService already enforces per-email rate limiting (3 requests per 15 min).
// For production, register a dedicated scoped plugin for /v1/auth with a lower max count.
await app.register(rateLimit, {
  max: RATE_LIMIT_MAX,
  timeWindow: RATE_LIMIT_WINDOW_MS,
});

// Health check — always public, no auth required
app.get('/health', async () => ({
  status: 'ok',
  service: 'api-gateway',
  timestamp: new Date().toISOString(),
}));

// Register proxy routes.
// Routes that requiresAuth wrap the proxy in a scoped plugin that adds an
// onRequest hook. This avoids relying on `preHandler` which some versions of
// @fastify/http-proxy do not expose.
for (const route of ROUTE_TABLE) {
  if (route.requiresAuth) {
    await app.register(
      async (scope) => {
        scope.addHook('onRequest', authMiddleware);
        await scope.register(proxy, {
          upstream: route.upstream,
          prefix: route.prefix,
          rewritePrefix: route.prefix,
          http2: false,
        });
      },
      { prefix: '' },
    );
  } else {
    await app.register(proxy, {
      upstream: route.upstream,
      prefix: route.prefix,
      rewritePrefix: route.prefix,
      http2: false,
    });
  }
}

// Start
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port: GATEWAY_PORT, host });
  app.log.info(`api-gateway running on ${host}:${GATEWAY_PORT}`);
  app.log.info(
    `Routes: ${ROUTE_TABLE.map((r) => `${r.prefix} → ${r.upstream} [auth=${r.requiresAuth}]`).join(', ')}`,
  );
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
