'use client';

import { useEffect } from 'react';
import type { Agent } from './types';

const CATEGORY_COLORS: Record<string, { color: string; bg: string; abbr: string }> = {
  search: { color: '#4d9ef5', bg: 'rgba(77,158,245,0.12)', abbr: 'WS' },
  code: { color: '#9b7cf8', bg: 'rgba(155,124,248,0.12)', abbr: 'CE' },
  file: { color: '#00e5a0', bg: 'rgba(0,229,160,0.12)', abbr: 'PP' },
  data: { color: '#f5a623', bg: 'rgba(245,166,35,0.12)', abbr: 'DW' },
  api: { color: '#e05252', bg: 'rgba(224,82,82,0.12)', abbr: 'AR' },
  llm: { color: '#c084fc', bg: 'rgba(192,132,252,0.12)', abbr: 'SC' },
};

const DEFAULT_CATEGORY = { color: '#8fa8c0', bg: 'rgba(143,168,192,0.12)', abbr: 'AG' };

interface AgentModalProps {
  agent: Agent;
  onClose: () => void;
}

export function AgentModal({ agent, onClose }: AgentModalProps) {
  const catStyle = CATEGORY_COLORS[agent.category] ?? DEFAULT_CATEGORY;

  const calls24h = agent.callsTotal > 0
    ? Math.round(agent.callsTotal / 30).toLocaleString()
    : '—';
  const uptime = agent.uptimePct != null ? `${agent.uptimePct.toFixed(1)}%` : '—';
  const latency = agent.timeoutMs != null ? `${(agent.timeoutMs / 1000).toFixed(1)}s` : '—';
  const rating = agent.reputation != null ? `${(agent.reputation / 20).toFixed(2)} / 5` : '—';
  const verifiedSince = agent.createdAt
    ? new Date(agent.createdAt).toISOString().slice(0, 7)
    : '—';

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleConnect = () => {
    navigator.clipboard.writeText(agent.id);
    window.alert(
      `Agent "${agent.name}" connected!\n\nAgent ID copied to clipboard: ${agent.id}\n\nUse this in your SDK:\nagntly.tasks.create(agent_id="${agent.id}", ...)`
    );
  };

  const handleViewDocs = () => {
    window.open('https://sandbox.api.agntly.io/v1/agents/' + agent.id, '_blank');
  };

  const handleCopy = async () => {
    const snippet = `# pip install agntly
from agntly import Agntly

agntly = Agntly(api_key="ag_live_...")
result = agntly.tasks.create(
    agent_id="${agent.id}",
    payload={"query": "your input here"},
    budget="${agent.priceUsdc}",
)
# result["task"]["status"] → "complete"
# result["task"]["result"] → agent output
# result["completion_token"] → for agent to confirm`;
    await navigator.clipboard.writeText(snippet);
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 z-[200] flex items-center justify-center backdrop-blur-[4px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-bg-1 border border-border-2 w-[540px] max-w-[95vw] max-h-[85vh] overflow-y-auto animate-[modalIn_0.2s_ease]"
        style={{ animation: 'modalIn 0.2s ease' }}
      >
        {/* Header */}
        <div className="px-5 py-[18px] border-b border-border flex items-center justify-between">
          <span className="font-mono text-[13px] font-medium text-t-0">
            {agent.id} — details
          </span>
          <button
            className="bg-transparent border-none text-t-2 text-[18px] cursor-pointer leading-none px-1 hover:text-t-0 transition-colors"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Agent header */}
          <div className="flex gap-[14px] items-start mb-5">
            <div
              className="w-12 h-12 flex items-center justify-center font-mono text-[16px] font-medium border flex-shrink-0"
              style={{ color: catStyle.color, borderColor: catStyle.color + '40', background: catStyle.bg }}
            >
              {catStyle.abbr}
            </div>
            <div>
              <div className="text-[18px] font-medium text-t-0 mb-1">{agent.name}</div>
              <div className="font-mono text-[11px] text-t-2">
                {agent.id} · verified since {verifiedSince}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="text-[13px] text-t-1 leading-[1.7] mb-[18px]">
            {agent.description}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-px bg-border border border-border mb-5">
            {[
              { label: 'price / call', value: `$${agent.priceUsdc} USDC`, green: true },
              { label: 'calls / 24h', value: calls24h, green: false },
              { label: 'uptime', value: uptime, green: true },
              { label: 'avg latency', value: latency, green: false },
              { label: 'rating', value: rating, green: true },
              { label: 'total earned', value: `$${(agent.callsTotal * parseFloat(agent.priceUsdc)).toFixed(2)}`, green: false },
            ].map((stat) => (
              <div key={stat.label} className="bg-bg-2 px-[14px] py-3 flex flex-col gap-1">
                <div className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase">
                  {stat.label}
                </div>
                <div className={`font-mono text-[15px] font-medium ${stat.green ? 'text-accent' : 'text-t-0'}`}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Quickstart label */}
          <div className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase mb-2">
            quickstart
          </div>

          {/* Code snippet */}
          <div className="bg-bg-0 border border-border px-4 py-[14px] font-mono text-[12px] leading-[1.7] text-t-1 overflow-x-auto whitespace-pre mb-4">
            <span className="text-t-2"># pip install agntly</span>{'\n'}
            <span className="text-blue">from</span>{' agntly '}
            <span className="text-blue">import</span>{' Agntly\n'}
            {'\n'}
            {'agntly = Agntly(api_key='}
            <span className="text-accent">&quot;ag_live_...&quot;</span>
            {')\n'}
            {'result = agntly.run(\n'}
            {'    agent_id='}
            <span className="text-accent">&quot;{agent.id}&quot;</span>
            {',\n'}
            {'    payload=\u007b '}
            <span className="text-accent">&quot;query&quot;</span>
            {': '}
            <span className="text-accent">&quot;your input here&quot;</span>
            {' \u007d,\n'}
            {'    budget='}
            <span className="text-accent">&quot;{agent.priceUsdc}&quot;</span>
            {',\n'}
            {')\n'}
            <span className="text-t-2"># result.data → structured output</span>{'\n'}
            <span className="text-t-2"># result.tx_hash → settlement proof</span>
          </div>

          {/* Actions */}
          <div className="flex gap-[10px]">
            <button
              className="flex-1 bg-accent border-none text-bg-0 font-mono text-[12px] font-medium py-[10px] tracking-[0.04em] hover:bg-accent-2 transition-colors cursor-pointer"
              onClick={handleConnect}
            >
              connect agent
            </button>
            <button
              className="bg-transparent border border-border-2 text-t-1 font-mono text-[12px] px-4 py-[10px] tracking-[0.04em] hover:border-t-1 hover:text-t-0 transition-all cursor-pointer"
              onClick={handleViewDocs}
            >
              view docs
            </button>
            <button
              className="bg-transparent border border-border-2 text-t-1 font-mono text-[12px] px-4 py-[10px] tracking-[0.04em] hover:border-t-1 hover:text-t-0 transition-all cursor-pointer"
              onClick={handleCopy}
            >
              copy sdk snippet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
