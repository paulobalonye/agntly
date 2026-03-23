import { SERVICE_URLS } from './config.js';

export interface RouteMapping {
  readonly prefix: string;
  readonly upstream: string;
  readonly requiresAuth: boolean;
}

export const ROUTE_TABLE: readonly RouteMapping[] = [
  { prefix: '/v1/auth', upstream: SERVICE_URLS.auth, requiresAuth: false },
  { prefix: '/v1/autonomous', upstream: SERVICE_URLS.auth, requiresAuth: false },
  { prefix: '/v1/wallets', upstream: SERVICE_URLS.wallet, requiresAuth: true },
  { prefix: '/v1/escrow', upstream: SERVICE_URLS.escrow, requiresAuth: true },
  { prefix: '/v1/tasks', upstream: SERVICE_URLS.task, requiresAuth: true },
  { prefix: '/v1/policies', upstream: SERVICE_URLS.task, requiresAuth: true },
  // Note: /v1/agents is public for GET (marketplace browsing).
  // Write operations (POST/PUT/DELETE) enforce auth in the registry-service routes.
  { prefix: '/v1/agents', upstream: SERVICE_URLS.registry, requiresAuth: false },
  // Note: /v1/payments is public because the Stripe webhook endpoint needs to be accessible.
  // The checkout endpoint enforces auth internally (checks userId in the handler).
  // TODO: Split into /v1/payments/webhook (public) and /v1/payments/* (auth required)
  { prefix: '/v1/payments', upstream: SERVICE_URLS.payment, requiresAuth: false },
  { prefix: '/v1/webhooks', upstream: SERVICE_URLS.webhook, requiresAuth: true },
];
