'use client';

import { useMemo, useState } from 'react';
import type { Agent, FilterState } from './types';

interface CategoryDef {
  key: string;
  label: string;
  dotColor: string;
}

const CATEGORY_DEFS: CategoryDef[] = [
  { key: 'all', label: 'all agents', dotColor: '#8fa8c0' },
  { key: 'search', label: 'web search', dotColor: '#4d9ef5' },
  { key: 'code', label: 'code executor', dotColor: '#9b7cf8' },
  { key: 'data', label: 'data processor', dotColor: '#f5a623' },
  { key: 'file', label: 'file / doc', dotColor: '#00e5a0' },
  { key: 'api', label: 'API caller', dotColor: '#e05252' },
  { key: 'llm', label: 'LLM wrapper', dotColor: '#c084fc' },
  { key: 'research', label: 'research', dotColor: '#38bdf8' },
];

interface FilterSidebarProps {
  agents: Agent[];
  onFilterChange: (filters: Partial<FilterState>) => void;
}

export function FilterSidebar({ agents, onFilterChange }: FilterSidebarProps) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeStatus, setActiveStatus] = useState('');
  const [priceVal, setPriceVal] = useState(100);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [searchQ, setSearchQ] = useState('');

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: agents.length };
    for (const agent of agents) {
      counts[agent.category] = (counts[agent.category] ?? 0) + 1;
    }
    return counts;
  }, [agents]);

  const statusCounts = useMemo(() => {
    const counts = { active: 0, paused: 0 };
    for (const agent of agents) {
      if (agent.status === 'active') counts.active++;
      else if (agent.status === 'paused') counts.paused++;
    }
    return counts;
  }, [agents]);

  const handleCategory = (key: string) => {
    const next = activeCategory === key ? 'all' : key;
    setActiveCategory(next);
    onFilterChange({ category: next === 'all' ? '' : next });
  };

  const handleStatus = (key: string) => {
    const next = activeStatus === key ? '' : key;
    setActiveStatus(next);
    onFilterChange({ status: next });
  };

  const handlePrice = (val: number) => {
    setPriceVal(val);
    const maxPrice = (val / 100) * 0.02;
    onFilterChange({ maxPrice });
  };

  const handleSearch = (q: string) => {
    setSearchQ(q);
    onFilterChange({ q });
  };

  const handleVerified = () => {
    const next = !verifiedOnly;
    setVerifiedOnly(next);
    onFilterChange({ verifiedOnly: next });
  };

  const priceLabel = '$' + ((priceVal / 100) * 0.02).toFixed(3);

  return (
    <aside className="border-r border-border pt-5 bg-bg-1 sticky top-[52px] h-[calc(100vh-52px-58px)] overflow-y-auto">
      {/* Search */}
      <div className="px-4 mb-5">
        <input
          type="text"
          value={searchQ}
          placeholder="search agents..."
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full bg-bg-2 border border-border text-t-0 font-mono text-[12px] px-3 py-2 outline-none focus:border-accent transition-colors placeholder:text-t-2"
        />
      </div>

      {/* Categories */}
      <div className="mb-6">
        <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase px-5 mb-2">
          category
        </div>
        {CATEGORY_DEFS
          .filter((cat) => cat.key === 'all' || (categoryCounts[cat.key] ?? 0) > 0)
          .map((cat) => {
            const isActive = activeCategory === cat.key;
            const count = categoryCounts[cat.key] ?? 0;
            return (
              <div
                key={cat.key}
                onClick={() => handleCategory(cat.key)}
                className={[
                  'flex items-center justify-between px-5 py-[7px] cursor-pointer transition-colors border-l-2',
                  isActive
                    ? 'bg-accent/[0.06] border-l-accent'
                    : 'border-l-transparent hover:bg-bg-2',
                ].join(' ')}
              >
                <span className={`text-[13px] flex items-center gap-2 ${isActive ? 'text-accent' : 'text-t-1'}`}>
                  <span
                    className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                    style={{ background: cat.dotColor }}
                  />
                  {cat.label}
                </span>
                <span className="font-mono text-[11px] text-t-2 bg-bg-3 px-[6px] py-px">
                  {count.toLocaleString()}
                </span>
              </div>
            );
          })}
      </div>

      {/* Status */}
      <div className="mb-6">
        <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase px-5 mb-2">
          status
        </div>
        {[
          { key: 'active', label: 'online', dotColor: '#00e5a0', count: statusCounts.active },
          { key: 'paused', label: 'busy', dotColor: '#f5a623', count: statusCounts.paused },
        ].map((s) => {
          const isActive = activeStatus === s.key;
          return (
            <div
              key={s.key}
              onClick={() => handleStatus(s.key)}
              className={[
                'flex items-center justify-between px-5 py-[7px] cursor-pointer transition-colors border-l-2',
                isActive
                  ? 'bg-accent/[0.06] border-l-accent'
                  : 'border-l-transparent hover:bg-bg-2',
              ].join(' ')}
            >
              <span className={`text-[13px] flex items-center gap-2 ${isActive ? 'text-accent' : 'text-t-1'}`}>
                <span
                  className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                  style={{ background: s.dotColor }}
                />
                {s.label}
              </span>
              <span className="font-mono text-[11px] text-t-2 bg-bg-3 px-[6px] py-px">
                {s.count.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Price range */}
      <div className="mb-6">
        <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase px-5 mb-2">
          max price / call
        </div>
        <div className="px-5">
          <div className="flex justify-between font-mono text-[11px] text-t-2 mb-[6px]">
            <span>$0.000</span>
            <span>{priceLabel}</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={priceVal}
            onChange={(e) => handlePrice(Number(e.target.value))}
            className="w-full appearance-none h-[2px] bg-border-2 outline-none cursor-pointer accent-accent"
          />
        </div>
      </div>

      {/* Reputation */}
      <div className="mb-6">
        <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase px-5 mb-2">
          reputation
        </div>
        <div
          onClick={handleVerified}
          className={[
            'flex items-center px-5 py-[7px] cursor-pointer transition-colors border-l-2',
            verifiedOnly
              ? 'bg-accent/[0.06] border-l-accent'
              : 'border-l-transparent hover:bg-bg-2',
          ].join(' ')}
        >
          <span className={`text-[13px] flex items-center gap-2 ${verifiedOnly ? 'text-accent' : 'text-t-1'}`}>
            <span className="w-[6px] h-[6px] rounded-full flex-shrink-0 bg-accent" />
            verified only
          </span>
        </div>
        <div className="flex items-center px-5 py-[7px] cursor-pointer transition-colors border-l-2 border-l-transparent hover:bg-bg-2">
          <span className="text-[13px] text-t-1 flex items-center gap-2">
            <span className="w-[6px] h-[6px] rounded-full flex-shrink-0 bg-amber" />
            top rated
          </span>
        </div>
      </div>
    </aside>
  );
}
