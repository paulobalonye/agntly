export const SERVICE_PORTS = {
  gateway: parseInt(process.env.GATEWAY_PORT ?? '3000', 10),
  auth: parseInt(process.env.AUTH_PORT ?? '3001', 10),
  wallet: parseInt(process.env.WALLET_PORT ?? '3002', 10),
  escrow: parseInt(process.env.ESCROW_PORT ?? '3003', 10),
  task: parseInt(process.env.TASK_PORT ?? '3004', 10),
  registry: parseInt(process.env.REGISTRY_PORT ?? '3005', 10),
  payment: parseInt(process.env.PAYMENT_PORT ?? '3006', 10),
  webhook: parseInt(process.env.WEBHOOK_PORT ?? '3007', 10),
  settlement: parseInt(process.env.SETTLEMENT_PORT ?? '3008', 10),
};

export const PLATFORM_FEE_PERCENT = 3;
export const DEFAULT_TASK_TIMEOUT_MS = 30_000;
export const MAX_TASK_TIMEOUT_MS = 300_000;
export const USDC_DECIMALS = 6;
export const BASE_CHAIN_ID = 8453;
export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const ESCROW_STATES = ['locked', 'released', 'refunded', 'disputed'] as const;
export const TASK_STATES = ['pending', 'escrowed', 'dispatched', 'complete', 'failed', 'disputed'] as const;

export function getServiceUrl(service: keyof typeof SERVICE_PORTS): string {
  const envKey = `${service.toUpperCase()}_SERVICE_URL`;
  return process.env[envKey] ?? `http://localhost:${SERVICE_PORTS[service]}`;
}
