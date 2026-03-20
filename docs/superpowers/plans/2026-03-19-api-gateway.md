# API Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight Fastify API gateway (port 3000) that routes, authenticates, and rate-limits all API traffic through a single endpoint — the unified `sandbox.api.agntly.io` entry point that both SDKs target.

**Architecture:** Fastify service with `@fastify/http-proxy` for reverse proxying. Auth middleware validates JWT/API keys before forwarding. Rate limiter uses `@fastify/rate-limit` with Redis backing. Path-prefix routing maps to backend services. No business logic — pure infrastructure.

**Tech Stack:** Fastify, @fastify/http-proxy, @fastify/rate-limit, ioredis, JWT

---

## File Structure

```
services/api-gateway/
├── package.json
├── tsconfig.json
└── src/
    ├── server.ts           ← Entry point, registers proxies + middleware
    ├── routes.ts           ← Route table (prefix → service URL)
    ├── middleware/
    │   └── auth.ts         ← JWT/API key validation
    └── config.ts           ← Service URLs from env vars
```

---

## Task 1: Scaffold + route config

**Files:**
- Create: `services/api-gateway/package.json`
- Create: `services/api-gateway/tsconfig.json`
- Create: `services/api-gateway/src/config.ts`
- Create: `services/api-gateway/src/routes.ts`

**package.json:**
```json
{
  "name": "@agntly/api-gateway",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "@agntly/shared": "workspace:*",
    "fastify": "^5.2.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/http-proxy": "^11.0.0",
    "@fastify/rate-limit": "^10.0.0",
    "ioredis": "^5.4.0",
    "jsonwebtoken": "^9.0.0"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

**tsconfig.json:**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"],
  "references": [{ "path": "../../shared" }]
}
```

**config.ts** — Service URL mapping from env vars:
```typescript
export const SERVICE_URLS: Record<string, string> = {
  auth: process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001',
  wallet: process.env.WALLET_SERVICE_URL ?? 'http://localhost:3002',
  escrow: process.env.ESCROW_SERVICE_URL ?? 'http://localhost:3003',
  task: process.env.TASK_SERVICE_URL ?? 'http://localhost:3004',
  registry: process.env.REGISTRY_SERVICE_URL ?? 'http://localhost:3005',
  payment: process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:3006',
  webhook: process.env.WEBHOOK_SERVICE_URL ?? 'http://localhost:3007',
};

export const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT ?? '3000');
export const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX ?? '100');
export const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000');
```

**routes.ts** — Route table mapping URL prefixes to upstream services:
```typescript
import { SERVICE_URLS } from './config.js';

export interface RouteMapping {
  readonly prefix: string;
  readonly upstream: string;
  readonly requiresAuth: boolean;
}

export const ROUTE_TABLE: readonly RouteMapping[] = [
  { prefix: '/v1/auth', upstream: SERVICE_URLS.auth, requiresAuth: false },
  { prefix: '/v1/wallets', upstream: SERVICE_URLS.wallet, requiresAuth: true },
  { prefix: '/v1/escrow', upstream: SERVICE_URLS.escrow, requiresAuth: true },
  { prefix: '/v1/tasks', upstream: SERVICE_URLS.task, requiresAuth: true },
  { prefix: '/v1/agents', upstream: SERVICE_URLS.registry, requiresAuth: false },
  { prefix: '/v1/payments', upstream: SERVICE_URLS.payment, requiresAuth: false },
  { prefix: '/v1/webhooks', upstream: SERVICE_URLS.webhook, requiresAuth: true },
];
```

Note: `/v1/auth` and `/v1/agents` (public browsing) and `/v1/payments` (Stripe webhook) don't require auth. The payment checkout endpoint has its own auth check internally.

**After implementing:**
```bash
cd /Users/drpraize/agntly && pnpm install
git add services/api-gateway/package.json services/api-gateway/tsconfig.json services/api-gateway/src/config.ts services/api-gateway/src/routes.ts
git commit -m "feat: scaffold API gateway with route table and config"
```

---

## Task 2: Auth middleware

**Files:**
- Create: `services/api-gateway/src/middleware/auth.ts`

Validates JWT tokens and API keys before requests reach backend services. This is a gateway-level check — it verifies the token is valid and not expired. The backend services do their own fine-grained authorization.

```typescript
import jwt from 'jsonwebtoken';
import type { FastifyRequest, FastifyReply } from 'fastify';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production-min-32';

export interface AuthContext {
  userId: string;
  email: string;
  role: string;
  authType: 'jwt' | 'api-key';
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const header = request.headers.authorization;
  if (!header) {
    return reply.status(401).send({ success: false, data: null, error: 'Authorization header required' });
  }

  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return reply.status(401).send({ success: false, data: null, error: 'Invalid authorization format. Use: Bearer <token>' });
  }

  // API key — starts with 'ag_'
  // Pass through to the backend service which validates against the DB
  if (token.startsWith('ag_')) {
    return; // Let the backend service validate the key
  }

  // JWT — validate signature and expiry
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string };
    // Attach user info to headers so backend services can read it
    request.headers['x-user-id'] = payload.userId;
    request.headers['x-user-email'] = payload.email;
    request.headers['x-user-role'] = payload.role;
  } catch {
    return reply.status(401).send({ success: false, data: null, error: 'Invalid or expired token' });
  }
}
```

**After implementing:**
```bash
git add services/api-gateway/src/middleware/
git commit -m "feat: add gateway auth middleware for JWT and API key validation"
```

---

## Task 3: Server with proxy routing + rate limiting

**Files:**
- Create: `services/api-gateway/src/server.ts`

The main server that:
1. Registers CORS
2. Registers rate limiting (per IP, 100 req/min default)
3. Registers health check
4. For each route in the route table: registers `@fastify/http-proxy` with optional auth preHandler

```typescript
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

// CORS
await app.register(cors, { origin: true });

// Rate limiting
await app.register(rateLimit, {
  max: RATE_LIMIT_MAX,
  timeWindow: RATE_LIMIT_WINDOW_MS,
  // Use IP-based limiting. Can switch to API-key-based later.
});

// Health check
app.get('/health', async () => ({
  status: 'ok',
  service: 'api-gateway',
  timestamp: new Date().toISOString(),
  routes: ROUTE_TABLE.map(r => r.prefix),
}));

// Register proxy routes
for (const route of ROUTE_TABLE) {
  await app.register(proxy, {
    upstream: route.upstream,
    prefix: route.prefix,
    rewritePrefix: route.prefix,
    http2: false,
    ...(route.requiresAuth
      ? { preHandler: authMiddleware }
      : {}),
  });
}

// Start
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port: GATEWAY_PORT, host });
  app.log.info(`api-gateway running on ${host}:${GATEWAY_PORT}`);
  app.log.info(`Routes: ${ROUTE_TABLE.map(r => `${r.prefix} → ${r.upstream}`).join(', ')}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
```

**After implementing:**
1. Build: `cd /Users/drpraize/agntly && pnpm --filter @agntly/shared build && pnpm --filter @agntly/api-gateway build`
2. Commit:
```bash
git add services/api-gateway/src/server.ts
git commit -m "feat: add API gateway with proxy routing, rate limiting, and auth"
```

---

## Task 4: Add to Docker Compose + update shared config

**Files:**
- Modify: `docker-compose.yml` — Add api-gateway service
- Modify: `shared/src/config/index.ts` — Add gateway port

**Docker Compose addition:**
```yaml
  api-gateway:
    build:
      context: .
      dockerfile: services/api-gateway/Dockerfile
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - auth-service
      - wallet-service
      - escrow-engine
      - task-service
      - registry-service
      - payment-service
      - webhook-service
```

**Shared config** — add `gateway: 3000` to SERVICE_PORTS.

**After implementing:**
```bash
git add docker-compose.yml shared/src/config/index.ts
git commit -m "feat: add API gateway to Docker Compose and shared config"
```

---

## Summary

| Task | What it does | Files |
|------|-------------|-------|
| 1 | Scaffold + route config | `package.json`, `tsconfig.json`, `config.ts`, `routes.ts` |
| 2 | Auth middleware | `middleware/auth.ts` |
| 3 | Server with proxy + rate limit | `server.ts` |
| 4 | Docker Compose + shared config | `docker-compose.yml`, `config/index.ts` |

**Total: 4 tasks, ~7 files. Lightweight proxy — no business logic.**

**What this enables:**
- SDKs target `http://localhost:3000` (or `sandbox.api.agntly.io` in production) — single URL for everything
- Rate limiting: 100 req/min per IP (configurable via env)
- Auth validated at the gateway — invalid tokens rejected before reaching services
- All services accessible through one port
