// --- Config ---
export interface AgntlyConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly timeout?: number;
}

// --- Agents ---
export interface Agent {
  readonly id: string;
  readonly ownerId: string;
  readonly walletId: string;
  readonly name: string;
  readonly description: string;
  readonly endpoint: string;
  readonly priceUsdc: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly status: 'active' | 'paused' | 'delisted';
  readonly verified: boolean;
  readonly reputation: number;
  readonly callsTotal: number;
  readonly uptimePct: number;
  readonly timeoutMs: number;
  readonly createdAt: string;
}

export interface RegisterAgentParams {
  readonly agentId: string;
  readonly name: string;
  readonly description: string;
  readonly endpoint: string;
  readonly priceUsdc: string;
  readonly category: string;
  readonly tags?: readonly string[];
}

export interface ListAgentsParams {
  readonly category?: string;
  readonly status?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface UpdateAgentParams {
  readonly name?: string;
  readonly description?: string;
  readonly endpoint?: string;
  readonly priceUsdc?: string;
  readonly category?: string;
  readonly tags?: readonly string[];
}

// --- Tasks ---
export interface Task {
  readonly id: string;
  readonly orchestratorId: string;
  readonly agentId: string;
  readonly payload: Record<string, unknown>;
  readonly result: Record<string, unknown> | null;
  readonly status: 'pending' | 'escrowed' | 'dispatched' | 'complete' | 'failed' | 'disputed';
  readonly amount: string;
  readonly fee: string;
  readonly escrowTx: string | null;
  readonly settleTx: string | null;
  readonly deadline: string;
  readonly latencyMs: number | null;
  readonly createdAt: string;
}

export interface CreateTaskParams {
  readonly agentId: string;
  readonly payload: Record<string, unknown>;
  readonly budget: string;
  readonly timeoutMs?: number;
}

export interface CompleteTaskParams {
  readonly result: Record<string, unknown>;
  readonly completionToken: string;
  readonly proof?: string;
}

export interface DisputeTaskParams {
  readonly reason: string;
  readonly evidence?: string;
}

// --- Wallets ---
export interface Wallet {
  readonly id: string;
  readonly ownerId: string;
  readonly agentId: string | null;
  readonly address: string;
  readonly balance: string;
  readonly locked: string;
  readonly chain: string;
}

export interface CreateWalletParams {
  readonly agentId?: string;
}

export interface FundWalletParams {
  readonly amountUsd: number;
  readonly method: 'card' | 'ach' | 'usdc';
}

export interface FundResult {
  readonly depositId: string;
  readonly amountUsd: number;
  readonly usdcAmount: string;
  readonly status: string;
  readonly etaSeconds: number;
}

export interface WithdrawParams {
  readonly amount: string;
  readonly destination: string;
}

export interface Withdrawal {
  readonly withdrawalId: string;
  readonly amount: string;
  readonly destination: string;
  readonly fee: string;
  readonly status: string;
}

// --- Pagination ---
export interface PaginationParams {
  readonly limit?: number;
  readonly offset?: number;
}

export interface PaginatedResponse<T> {
  readonly data: readonly T[];
  readonly meta: {
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
  };
}
