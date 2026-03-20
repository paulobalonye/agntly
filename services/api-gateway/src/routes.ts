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
