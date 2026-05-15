'use client';

import { useCallback, useState } from 'react';
import { AgentCard } from './AgentCard';
import { AgentModal } from './AgentModal';
import { FilterSidebar } from './FilterSidebar';
import type { Agent, FilterState } from './types';

const SORT_BUTTONS = ['volume', 'price', 'rating', 'newest'] as const;
type SortKey = (typeof SORT_BUTTONS)[number];

interface AgentGridProps {
  initialAgents: Agent[];
}

function clientFilter(agents: Agent[], filters: FilterState): Agent[] {
  let result = agents;

  if (filters.q) {
    const q = filters.q.toLowerCase();
    result = result.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  if (filters.category && filters.category !== 'all') {
    result = result.filter((a) => a.category === filters.category);
  }

  if (filters.status) {
    result = result.filter((a) => a.status === filters.status);
  }

  if (filters.maxPrice > 0 && filters.maxPrice < 0.02) {
    result = result.filter((a) => parseFloat(a.priceUsdc) <= filters.maxPrice);
  }

  if (filters.verifiedOnly) {
    result = result.filter((a) => a.verified);
  }

  return result;
}

function clientSort(agents: Agent[], sort: SortKey): Agent[] {
  return [...agents].sort((a, b) => {
    switch (sort) {
      case 'price':
        return parseFloat(a.priceUsdc) - parseFloat(b.priceUsdc);
      case 'rating':
        return (b.reputation ?? 0) - (a.reputation ?? 0);
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'volume':
      default:
        return (b.callsTotal ?? 0) - (a.callsTotal ?? 0);
    }
  });
}

export function AgentGrid({ initialAgents }: AgentGridProps) {
  const [agents] = useState<Agent[]>(initialAgents);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [sort, setSort] = useState<SortKey>('volume');
  const [filters, setFilters] = useState<FilterState>({
    q: '',
    category: '',
    status: '',
    maxPrice: 0.02,
    sort: 'volume',
    verifiedOnly: false,
  });

  const handleFilterChange = useCallback((partial: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const filtered = clientFilter(agents, filters);
  const sorted = clientSort(filtered, sort);

  return (
    <div className="grid" style={{ gridTemplateColumns: '220px 1fr' }}>
      {/* Left sidebar */}
      <FilterSidebar agents={agents} onFilterChange={handleFilterChange} />

      {/* Main content */}
      <main className="p-6 overflow-y-auto">
        {/* Content header */}
        <div className="flex items-center justify-between mb-5">
          <div className="font-mono text-[12px] text-t-2 tracking-[0.06em]">
            showing <span className="text-t-0 font-medium">{sorted.length.toLocaleString()}</span> agents
          </div>
          <div className="flex gap-[6px]">
            {SORT_BUTTONS.map((btn) => (
              <button
                key={btn}
                onClick={() => setSort(btn)}
                className={[
                  'bg-transparent font-mono text-[11px] px-[10px] py-[5px] tracking-[0.03em] transition-all cursor-pointer',
                  sort === btn
                    ? 'border border-border-2 text-t-0'
                    : 'border border-border text-t-2 hover:border-border-2 hover:text-t-0',
                ].join(' ')}
              >
                {btn}
              </button>
            ))}
          </div>
        </div>

        {/* Cards grid */}
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {sorted.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onSelect={setSelectedAgent} />
          ))}
          {sorted.length === 0 && (
            <div className="col-span-full text-center py-16 font-mono text-[13px] text-t-2">
              no agents match your filters
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {selectedAgent && (
        <AgentModal agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}
    </div>
  );
}
