export const SERVICE_PORTS = {
  gateway: 3000,
  auth: 3001,
  wallet: 3002,
  escrow: 3003,
  task: 3004,
  registry: 3005,
  payment: 3006,
  webhook: 3007,
  settlement: 3008,
} as const;

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
