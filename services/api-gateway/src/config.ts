export const SERVICE_URLS: Record<string, string> = {
  auth: process.env.AUTH_SERVICE_URL ?? 'http://localhost:3001',
  wallet: process.env.WALLET_SERVICE_URL ?? 'http://localhost:3002',
  escrow: process.env.ESCROW_SERVICE_URL ?? 'http://localhost:3003',
  task: process.env.TASK_SERVICE_URL ?? 'http://localhost:3004',
  registry: process.env.REGISTRY_SERVICE_URL ?? 'http://localhost:3005',
  payment: process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:3006',
  webhook: process.env.WEBHOOK_SERVICE_URL ?? 'http://localhost:3007',
};

export const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT ?? '3000', 10);
export const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10);
export const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);
