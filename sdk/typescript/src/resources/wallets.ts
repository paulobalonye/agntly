import type { HttpClient } from '../client.js';
import type {
  Wallet,
  CreateWalletParams,
  FundWalletParams,
  FundResult,
  WithdrawParams,
  Withdrawal,
  PaginationParams,
  PaginatedResponse,
} from '../types.js';

export class WalletsResource {
  constructor(private readonly client: HttpClient) {}

  async create(params?: CreateWalletParams): Promise<Wallet> {
    return this.client.post<Wallet>('/v1/wallets', params ?? {});
  }

  async get(walletId: string): Promise<Wallet> {
    return this.client.get<Wallet>(`/v1/wallets/${encodeURIComponent(walletId)}`);
  }

  async fund(walletId: string, params: FundWalletParams): Promise<FundResult> {
    return this.client.post<FundResult>(`/v1/wallets/${encodeURIComponent(walletId)}/fund`, params);
  }

  async withdraw(walletId: string, params: WithdrawParams): Promise<Withdrawal> {
    return this.client.post<Withdrawal>(`/v1/wallets/${encodeURIComponent(walletId)}/withdraw`, params);
  }

  async withdrawals(walletId: string, params?: PaginationParams): Promise<PaginatedResponse<Withdrawal>> {
    return this.client.getPaginated<Withdrawal>(
      `/v1/wallets/${encodeURIComponent(walletId)}/withdrawals`,
      params as Record<string, string | number | undefined>,
    );
  }
}
