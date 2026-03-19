import { randomUUID } from 'node:crypto';

export function generateId(prefix: string): string {
  const uuid = randomUUID().replace(/-/g, '');
  return `${prefix}_${uuid.slice(0, 16)}`;
}

export function createApiResponse<T>(data: T): { success: true; data: T; error: null } {
  return { success: true, data, error: null };
}

export function createErrorResponse(error: string): { success: false; data: null; error: string } {
  return { success: false, data: null, error };
}

export function usdcToSmallest(amount: string): bigint {
  const parts = amount.split('.');
  const whole = parts[0] ?? '0';
  const frac = (parts[1] ?? '').padEnd(6, '0').slice(0, 6);
  return BigInt(whole) * 1_000_000n + BigInt(frac);
}

export function smallestToUsdc(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const frac = (amount % 1_000_000n).toString().padStart(6, '0');
  return `${whole}.${frac}`;
}

export function calculateFee(amount: string, feePercent: number = 3): { fee: string; net: string } {
  const total = usdcToSmallest(amount);
  const feeAmount = (total * BigInt(feePercent * 100)) / 10000n;
  const netAmount = total - feeAmount;
  return {
    fee: smallestToUsdc(feeAmount),
    net: smallestToUsdc(netAmount),
  };
}
