'use client';

import { useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

type AgentStatus = 'active' | 'paused' | 'delisted';
type AgentCategory = 'search' | 'code' | 'data' | 'file' | 'api' | 'llm';

interface MyAgent {
  id: string;
  name: string;
  description: string;
  endpointUrl: string;
  pricePerCall: string;
  category: AgentCategory;
  tags: string[];
  status: AgentStatus;
  callsPer24h: number;
  earnings: string;
  uptime: string;
}

// ── Demo data ────────────────────────────────────────────────────────────────

const INITIAL_AGENTS: MyAgent[] = [
  {
    id: 'ag_web_search_v2',
    name: 'WebSearch Pro',
    description: 'Real-time web search with result ranking and citation extraction.',
    endpointUrl: 'https://agents.example.com/web-search',
    pricePerCall: '0.002500',
    category: 'search',
    tags: ['search', 'web', 'citations'],
    status: 'active',
    callsPer24h: 1284,
    earnings: '3.210000',
    uptime: '99.8%',
  },
  {
    id: 'ag_code_review_v1',
    name: 'CodeReview Agent',
    description: 'Automated code review with security analysis and best-practice suggestions.',
    endpointUrl: 'https://agents.example.com/code-review',
    pricePerCall: '0.005000',
    category: 'code',
    tags: ['code', 'review', 'security'],
    status: 'paused',
    callsPer24h: 0,
    earnings: '0.000000',
    uptime: '0%',
  },
];

const CATEGORIES: { value: AgentCategory; label: string }[] = [
  { value: 'search', label: 'Search' },
  { value: 'code', label: 'Code' },
  { value: 'data', label: 'Data' },
  { value: 'file', label: 'File' },
  { value: 'api', label: 'API' },
  { value: 'llm', label: 'LLM' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusPill(status: AgentStatus): string {
  switch (status) {
    case 'active':
      return 'bg-accent/10 text-accent border border-accent/25';
    case 'paused':
      return 'bg-amber/10 text-amber border border-amber/25';
    case 'delisted':
      return 'bg-red/10 text-red border border-red/25';
  }
}

function categoryPill(category: AgentCategory): string {
  const map: Record<AgentCategory, string> = {
    search: 'bg-blue/10 text-blue border border-blue/25',
    code: 'bg-purple/10 text-purple border border-purple/25',
    data: 'bg-accent/10 text-accent border border-accent/25',
    file: 'bg-t-2/15 text-t-1 border border-border',
    api: 'bg-amber/10 text-amber border border-amber/25',
    llm: 'bg-purple/10 text-purple border border-purple/25',
  };
  return map[category];
}

// ── Registration Form ────────────────────────────────────────────────────────

interface RegistrationFormProps {
  onRegistered: (agent: MyAgent) => void;
}

function RegistrationForm({ onRegistered }: RegistrationFormProps) {
  const [fields, setFields] = useState({
    id: '',
    name: '',
    description: '',
    endpointUrl: '',
    pricePerCall: '',
    category: 'search' as AgentCategory,
    tags: '',
  });
  const [errors, setErrors] = useState<Partial<typeof fields>>({});
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [formError, setFormError] = useState('');

  function setField<K extends keyof typeof fields>(key: K, value: typeof fields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): boolean {
    const next: Partial<typeof fields> = {};

    if (!fields.id.trim()) next.id = 'Agent ID is required.';
    if (!fields.name.trim()) next.name = 'Name is required.';
    if (!fields.description.trim()) next.description = 'Description is required.';

    try {
      new URL(fields.endpointUrl);
    } catch {
      next.endpointUrl = 'Enter a valid URL (e.g. https://...).';
    }

    const price = parseFloat(fields.pricePerCall);
    if (!fields.pricePerCall || isNaN(price) || price < 0) {
      next.pricePerCall = 'Enter a valid non-negative price.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitState('loading');
    setFormError('');

    try {
      const payload = {
        agentId: fields.id.trim(),
        name: fields.name.trim(),
        description: fields.description.trim(),
        endpointUrl: fields.endpointUrl.trim(),
        pricePerCall: fields.pricePerCall,
        category: fields.category,
        tags: fields.tags.split(',').map((t) => t.trim()).filter(Boolean),
      };

      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `Registry returned ${res.status}`);
      }

      const newAgent: MyAgent = {
        id: payload.agentId,
        name: payload.name,
        description: payload.description,
        endpointUrl: payload.endpointUrl,
        pricePerCall: parseFloat(payload.pricePerCall).toFixed(6),
        category: payload.category,
        tags: payload.tags,
        status: 'active',
        callsPer24h: 0,
        earnings: '0.000000',
        uptime: 'N/A',
      };

      onRegistered(newAgent);
      setSubmitState('idle');
      setFields({ id: '', name: '', description: '', endpointUrl: '', pricePerCall: '', category: 'search', tags: '' });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Registration failed.');
      setSubmitState('error');
    }
  }

  const inputClass =
    'w-full bg-bg-2 border border-border text-t-0 font-mono text-sm px-3 py-2 focus:border-accent focus:outline-none placeholder-t-3';
  const labelClass = 'font-mono text-[10px] text-t-2 block mb-1 uppercase tracking-[0.06em]';

  return (
    <div className="bg-bg-1 border border-border p-6 mb-6">
      <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-5">Register New Agent</div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Agent ID</label>
            <input
              type="text"
              value={fields.id}
              onChange={(e) => setField('id', e.target.value)}
              placeholder="ag_my_agent_v1"
              className={inputClass}
            />
            {errors.id && <div className="font-mono text-[10px] text-red mt-1">{errors.id}</div>}
          </div>
          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              value={fields.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="My Agent"
              className={inputClass}
            />
            {errors.name && <div className="font-mono text-[10px] text-red mt-1">{errors.name}</div>}
          </div>
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            value={fields.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="What does this agent do?"
            rows={3}
            className={`${inputClass} resize-none`}
          />
          {errors.description && <div className="font-mono text-[10px] text-red mt-1">{errors.description}</div>}
        </div>

        <div>
          <label className={labelClass}>Endpoint URL</label>
          <input
            type="text"
            value={fields.endpointUrl}
            onChange={(e) => setField('endpointUrl', e.target.value)}
            placeholder="https://your-agent.example.com/run"
            className={inputClass}
          />
          {errors.endpointUrl && <div className="font-mono text-[10px] text-red mt-1">{errors.endpointUrl}</div>}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Price per Call (USDC)</label>
            <input
              type="number"
              step="0.000001"
              min="0"
              value={fields.pricePerCall}
              onChange={(e) => setField('pricePerCall', e.target.value)}
              placeholder="0.002500"
              className={inputClass}
            />
            {errors.pricePerCall && <div className="font-mono text-[10px] text-red mt-1">{errors.pricePerCall}</div>}
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <select
              value={fields.category}
              onChange={(e) => setField('category', e.target.value as AgentCategory)}
              className={`${inputClass} cursor-pointer`}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tags (comma-separated)</label>
            <input
              type="text"
              value={fields.tags}
              onChange={(e) => setField('tags', e.target.value)}
              placeholder="search, web, ai"
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center gap-4 pt-1">
          <button
            type="submit"
            disabled={submitState === 'loading'}
            className="bg-accent text-bg-0 font-mono text-xs font-medium px-5 py-2 hover:bg-accent-2 transition-colors disabled:opacity-50"
          >
            {submitState === 'loading' ? 'registering...' : 'register agent'}
          </button>
          {formError && (
            <div className="font-mono text-[11px] text-red">{formError}</div>
          )}
        </div>
      </form>
    </div>
  );
}

// ── Agent Card ───────────────────────────────────────────────────────────────

interface AgentCardProps {
  agent: MyAgent;
  onStatusChange: (id: string, status: AgentStatus) => void;
  onDelist: (id: string) => void;
}

function AgentCard({ agent, onStatusChange, onDelist }: AgentCardProps) {
  return (
    <div className="bg-bg-1 border border-border p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display text-[15px] font-semibold text-t-0">{agent.name}</span>
            <span className={`font-mono text-[10px] px-2 py-[2px] tracking-[0.04em] ${statusPill(agent.status)}`}>
              {agent.status}
            </span>
            <span className={`font-mono text-[10px] px-2 py-[2px] tracking-[0.04em] ${categoryPill(agent.category)}`}>
              {agent.category}
            </span>
          </div>
          <div className="font-mono text-[11px] text-t-2 mb-1">{agent.id}</div>
          <div className="font-sans text-[12px] text-t-1 leading-snug">{agent.description}</div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          {agent.status !== 'delisted' && (
            <>
              {agent.status === 'active' ? (
                <button
                  onClick={() => onStatusChange(agent.id, 'paused')}
                  className="font-mono text-[11px] border border-border text-t-1 px-3 py-1 hover:border-amber hover:text-amber transition-all"
                >
                  pause
                </button>
              ) : (
                <button
                  onClick={() => onStatusChange(agent.id, 'active')}
                  className="font-mono text-[11px] border border-border text-t-1 px-3 py-1 hover:border-accent hover:text-accent transition-all"
                >
                  activate
                </button>
              )}
              <button
                onClick={() => onDelist(agent.id)}
                className="font-mono text-[11px] border border-red/30 text-red px-3 py-1 hover:bg-red/10 transition-all"
              >
                delist
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 pt-3 border-t border-border">
        <div>
          <div className="font-mono text-[10px] text-t-2 uppercase tracking-[0.06em] mb-1">price/call</div>
          <div className="font-mono text-[13px] text-accent">${agent.pricePerCall}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] text-t-2 uppercase tracking-[0.06em] mb-1">calls/24h</div>
          <div className="font-mono text-[13px] text-t-0">{agent.callsPer24h.toLocaleString()}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] text-t-2 uppercase tracking-[0.06em] mb-1">earnings/24h</div>
          <div className="font-mono text-[13px] text-accent">${agent.earnings}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] text-t-2 uppercase tracking-[0.06em] mb-1">uptime</div>
          <div className="font-mono text-[13px] text-t-0">{agent.uptime}</div>
        </div>
      </div>

      {/* Tags */}
      {agent.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {agent.tags.map((tag) => (
            <span
              key={tag}
              className="font-mono text-[10px] text-t-2 border border-border px-2 py-[2px] tracking-[0.04em]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MyAgentsPage() {
  const [agents, setAgents] = useState<MyAgent[]>(INITIAL_AGENTS);
  const [showForm, setShowForm] = useState(false);

  function handleRegistered(agent: MyAgent) {
    setAgents((prev) => [...prev, agent]);
    setShowForm(false);
  }

  function handleStatusChange(id: string, status: AgentStatus) {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
  }

  function handleDelist(id: string) {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'delisted' as AgentStatus } : a))
    );
  }

  const activeCount = agents.filter((a) => a.status === 'active').length;
  const totalCalls = agents.reduce((sum, a) => sum + a.callsPer24h, 0);
  const totalEarnings = agents
    .reduce((sum, a) => sum + parseFloat(a.earnings), 0)
    .toFixed(6);

  return (
    <div className="relative z-[1] min-h-[calc(100vh-52px-58px)] px-8 py-8 max-w-[960px] mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-1">builder dashboard</div>
          <h1 className="font-display text-[26px] font-semibold text-t-0 leading-tight">My Agents</h1>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={`font-mono text-[12px] px-5 py-2 border transition-all ${
            showForm
              ? 'bg-bg-2 border-border text-t-1'
              : 'bg-accent border-accent text-bg-0 hover:bg-accent-2 hover:border-accent-2'
          }`}
        >
          {showForm ? '✕ cancel' : '+ register new agent'}
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-bg-1 border border-border px-5 py-4">
          <div className="font-mono text-[10px] text-t-2 uppercase tracking-[0.06em] mb-2">active agents</div>
          <div className="font-mono text-[24px] font-medium text-accent">{activeCount}</div>
        </div>
        <div className="bg-bg-1 border border-border px-5 py-4">
          <div className="font-mono text-[10px] text-t-2 uppercase tracking-[0.06em] mb-2">calls/24h</div>
          <div className="font-mono text-[24px] font-medium text-t-0">{totalCalls.toLocaleString()}</div>
        </div>
        <div className="bg-bg-1 border border-border px-5 py-4">
          <div className="font-mono text-[10px] text-t-2 uppercase tracking-[0.06em] mb-2">earnings/24h</div>
          <div className="font-mono text-[24px] font-medium text-accent">${totalEarnings}</div>
        </div>
      </div>

      {/* Registration form (toggled) */}
      {showForm && <RegistrationForm onRegistered={handleRegistered} />}

      {/* Agent list */}
      <div className="flex flex-col gap-4">
        {agents.length === 0 ? (
          <div className="bg-bg-1 border border-border px-6 py-10 text-center">
            <div className="font-mono text-[12px] text-t-2 mb-2">No agents registered yet.</div>
            <div className="font-mono text-[11px] text-t-3">
              Click &quot;+ Register New Agent&quot; to get started.
            </div>
          </div>
        ) : (
          agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onStatusChange={handleStatusChange}
              onDelist={handleDelist}
            />
          ))
        )}
      </div>
    </div>
  );
}
