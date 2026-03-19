export type UserRole = 'developer' | 'admin';
export type KycStatus = 'none' | 'pending' | 'verified';
export type AgentStatus = 'active' | 'paused' | 'delisted';
export type TaskStatus = 'pending' | 'escrowed' | 'dispatched' | 'complete' | 'failed' | 'disputed';
export type EscrowState = 'locked' | 'released' | 'refunded' | 'disputed';
export type WebhookEvent =
  | 'task.created'
  | 'task.escrowed'
  | 'task.dispatched'
  | 'task.completed'
  | 'task.failed'
  | 'task.disputed'
  | 'escrow.locked'
  | 'escrow.released'
  | 'escrow.refunded'
  | 'escrow.failed'
  | 'wallet.funded'
  | 'wallet.withdrawn'
  | 'wallet.locked'
  | 'wallet.unlocked'
  | 'agent.verified';

export interface User {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
  readonly kycStatus: KycStatus;
  readonly stripeCustomerId: string | null;
  readonly createdAt: Date;
}

export interface Wallet {
  readonly id: string;
  readonly ownerId: string;
  readonly agentId: string | null;
  readonly address: string;
  readonly balance: string;
  readonly locked: string;
  readonly chain: string;
}

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
  readonly status: AgentStatus;
  readonly verified: boolean;
  readonly reputation: number;
  readonly callsTotal: number;
  readonly uptimePct: number;
  readonly timeoutMs: number;
  readonly featuredUntil: Date | null;
  readonly createdAt: Date;
}

export interface Task {
  readonly id: string;
  readonly orchestratorId: string;
  readonly agentId: string;
  readonly payload: Record<string, unknown>;
  readonly result: Record<string, unknown> | null;
  readonly status: TaskStatus;
  readonly amount: string;
  readonly fee: string;
  readonly escrowTx: string | null;
  readonly settleTx: string | null;
  readonly deadline: Date;
  readonly latencyMs: number | null;
  readonly createdAt: Date;
}

export interface Escrow {
  readonly id: string;
  readonly taskId: string;
  readonly fromWalletId: string;
  readonly toWalletId: string;
  readonly amount: string;
  readonly fee: string;
  readonly state: EscrowState;
  readonly txHash: string | null;
  readonly createdAt: Date;
  readonly settledAt: Date | null;
}

export interface ApiKey {
  readonly id: string;
  readonly userId: string;
  readonly keyHash: string;
  readonly prefix: string;
  readonly label: string;
  readonly lastUsedAt: Date | null;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
}

export interface WebhookSubscription {
  readonly id: string;
  readonly userId: string;
  readonly url: string;
  readonly secret: string;
  readonly events: readonly WebhookEvent[];
  readonly active: boolean;
  readonly createdAt: Date;
}

export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: string | null;
  readonly meta?: {
    readonly total?: number;
    readonly page?: number;
    readonly limit?: number;
  };
}

export interface ServiceEvent {
  readonly id: string;
  readonly type: WebhookEvent;
  readonly data: Record<string, unknown>;
  readonly timestamp: Date;
}
