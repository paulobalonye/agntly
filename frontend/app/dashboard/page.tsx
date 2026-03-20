import { OverviewCards } from '@/components/dashboard/OverviewCards';
import { EarningsChart } from '@/components/dashboard/EarningsChart';
import { MyAgentsTable } from '@/components/dashboard/MyAgentsTable';
import { RecentTasks } from '@/components/dashboard/RecentTasks';
import { WalletSection } from '@/components/dashboard/WalletSection';
import { ApiKeysSection } from '@/components/dashboard/ApiKeysSection';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  const json: ApiResponse<T> = await res.json();
  if (!json.success) throw new Error(json.error ?? `API error for ${path}`);
  return json.data;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase pb-3 border-b border-border mb-4">
      {children}
    </h2>
  );
}

const OVERVIEW_FALLBACK = {
  totalEarned: '0',
  earningsToday: '0',
  activeAgents: 0,
  avgRating: 0,
};

const WALLET_FALLBACK = {
  balance: '0',
  locked: '0',
  address: '—',
  withdrawals: [] as {
    id: string;
    amount: string;
    destination: string;
    status: string;
    txHash: string | null;
    date: string;
  }[],
};

async function safeFetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return await fetchJson<T>(path);
  } catch {
    return fallback;
  }
}

export default async function DashboardPage() {
  const [overview, agents, tasks, wallet] = await Promise.all([
    safeFetchJson<{
      totalEarned: string;
      earningsToday: string;
      activeAgents: number;
      avgRating: number;
    }>('/api/dashboard/overview', OVERVIEW_FALLBACK),
    safeFetchJson<
      {
        id: string;
        name: string;
        category: string;
        status: string;
        priceUsdc: string;
        calls24h: number;
        earnings24h: string;
        uptime: number;
      }[]
    >('/api/dashboard/agents', []),
    safeFetchJson<
      {
        id: string;
        agent: string;
        amount: string;
        status: string;
        timestamp: string;
      }[]
    >('/api/dashboard/tasks', []),
    safeFetchJson<{
      balance: string;
      locked: string;
      address: string;
      withdrawals: {
        id: string;
        amount: string;
        destination: string;
        status: string;
        txHash: string | null;
        date: string;
      }[];
    }>('/api/dashboard/wallet', WALLET_FALLBACK),
  ]);

  return (
    <main className="relative z-10 min-h-screen px-8 py-8 max-w-[1400px] mx-auto">
      {/* Page heading */}
      <div className="mb-8">
        <div className="font-mono text-[11px] text-accent tracking-[0.1em] uppercase mb-2">
          dashboard
        </div>
        <h1 className="font-display text-[32px] font-semibold text-t-0 leading-tight">
          Builder Dashboard
        </h1>
      </div>

      {/* Overview cards */}
      <section className="mb-8">
        <SectionHeading>Overview</SectionHeading>
        <OverviewCards data={overview} />
      </section>

      {/* Earnings chart + Wallet side by side */}
      <section className="mb-8">
        <SectionHeading>Earnings &amp; Wallet</SectionHeading>
        <div className="grid grid-cols-[2fr_1fr] gap-4 items-start">
          <EarningsChart />
          <WalletSection wallet={wallet} />
        </div>
      </section>

      {/* My Agents table */}
      <section className="mb-8">
        <SectionHeading>My Agents</SectionHeading>
        <MyAgentsTable agents={agents} />
      </section>

      {/* Recent Tasks */}
      <section className="mb-8">
        <SectionHeading>Recent Tasks</SectionHeading>
        <RecentTasks tasks={tasks} />
      </section>

      {/* API Keys */}
      <section className="mb-8">
        <SectionHeading>API Keys</SectionHeading>
        <ApiKeysSection />
      </section>
    </main>
  );
}
