export interface Agent {
  id: string;
  ownerId: string;
  walletId: string;
  name: string;
  description: string;
  endpoint: string;
  priceUsdc: string;
  category: string;
  tags: string[];
  status: 'active' | 'paused' | 'delisted';
  verified: boolean;
  reputation: number;
  callsTotal: number;
  uptimePct: number;
  timeoutMs: number;
  featuredUntil: string | null;
  createdAt: string;
}

export interface FilterState {
  q: string;
  category: string;
  status: string;
  maxPrice: number;
  sort: string;
  verifiedOnly: boolean;
}
