import { AgentGrid } from '@/components/marketplace/AgentGrid';
import { ActivityFeed } from '@/components/marketplace/ActivityFeed';
import { Leaderboard } from '@/components/marketplace/Leaderboard';
import { SparklineChart } from '@/components/marketplace/SparklineChart';
import type { Agent } from '@/components/marketplace/types';

async function fetchAgents(): Promise<Agent[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';
    const res = await fetch(`${baseUrl}/api/agents`, { cache: 'no-store' });

    if (!res.ok) {
      console.warn('[marketplace/page] Registry returned non-OK status:', res.status);
      return [];
    }

    const body = await res.json();

    // Handle both { data: Agent[] } envelope and raw Agent[]
    if (Array.isArray(body)) return body as Agent[];
    if (body?.data && Array.isArray(body.data)) return body.data as Agent[];

    return [];
  } catch (err) {
    console.warn('[marketplace/page] Failed to fetch agents:', err);
    return [];
  }
}

export default async function MarketplacePage() {
  const agents = await fetchAgents();

  return (
    <div
      className="relative z-[1] grid min-h-[calc(100vh-52px-58px)]"
      style={{ gridTemplateColumns: '220px 1fr 280px' }}
    >
      {/* Center: filter sidebar + agent grid (AgentGrid renders both internally) */}
      <div className="col-span-2">
        <AgentGrid initialAgents={agents} />
      </div>

      {/* Right panel */}
      <aside
        className="border-l border-border bg-bg-1 p-5 sticky top-[52px] h-[calc(100vh-52px-58px)] overflow-y-auto flex flex-col gap-5"
      >
        <SparklineChart />
        <ActivityFeed />
        <Leaderboard agents={agents} />
      </aside>
    </div>
  );
}
