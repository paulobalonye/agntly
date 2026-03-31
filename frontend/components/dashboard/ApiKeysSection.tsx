'use client';

import { useState, useEffect } from 'react';

interface ApiKey {
  id: string;
  prefix: string;
  label: string;
  lastUsed: string;
}

function normalizeKey(raw: Record<string, unknown>): ApiKey {
  const id = String(raw.id ?? raw.keyId ?? '');
  const label = String(raw.label ?? raw.name ?? '');
  const prefix = String(raw.prefix ?? raw.keyPrefix ?? (raw.key ? String(raw.key).slice(0, 16) + '...' : id.slice(0, 16) + '...'));
  const lastUsed = raw.lastUsedAt
    ? new Date(String(raw.lastUsedAt)).toLocaleString()
    : raw.lastUsed
    ? String(raw.lastUsed)
    : 'never';
  return { id, prefix, label, lastUsed };
}

export function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [revealedKey, setRevealedKey] = useState<{ id: string; fullKey: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [createState, setCreateState] = useState<'idle' | 'loading'>('idle');
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'done'>('idle');

  useEffect(() => {
    setLoadState('loading');
    fetch('/api/keys')
      .then((r) => r.json())
      .then((json) => {
        const list: unknown[] = json?.data ?? json?.keys ?? json ?? [];
        if (Array.isArray(list) && list.length > 0) {
          setKeys(list.map((k) => normalizeKey(k as Record<string, unknown>)));
        }
      })
      .catch(() => {
        // Keep empty on failure
      })
      .finally(() => setLoadState('done'));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setCreateState('loading');

    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim() }),
      });

      const json = await res.json();

      if (!res.ok) {
        setCreateState('idle');
        return;
      }

      const raw: Record<string, unknown> = json?.data ?? json;
      const fullKey = String(raw.key ?? raw.rawKey ?? raw.fullKey ?? '');
      const newKey = normalizeKey(raw);

      setKeys((prev) => [...prev, newKey]);
      if (fullKey) {
        setRevealedKey({ id: newKey.id, fullKey });
      }
    } catch {
      // key creation failed — UI stays in idle state
    } finally {
      setNewLabel('');
      setCreateState('idle');
    }
  }

  function handleRevoke(id: string) {
    setKeys((prev) => prev.filter((k) => k.id !== id));
    if (revealedKey?.id === id) setRevealedKey(null);
  }

  function handleCopyKey() {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey.fullKey).catch(() => {});
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1500);
  }

  return (
    <div className="bg-bg-1 border border-border overflow-hidden">
      {/* Key list header */}
      <div className="bg-bg-2 border-b border-border grid grid-cols-[2fr_1fr_1.5fr_auto] px-5 py-3">
        {['Key', 'Label', 'Last Used', ''].map((col, i) => (
          <div key={i} className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase">
            {col}
          </div>
        ))}
      </div>

      {loadState === 'loading' && (
        <div className="px-5 py-6 font-mono text-[12px] text-t-2 text-center">Loading keys…</div>
      )}

      {loadState !== 'loading' && keys.map((key) => (
        <div
          key={key.id}
          className="grid grid-cols-[2fr_1fr_1.5fr_auto] px-5 py-4 border-b border-border last:border-b-0 items-center gap-4"
        >
          <div className="font-mono text-[12px] text-accent">{key.prefix}</div>
          <div className="font-mono text-[12px] text-t-1">{key.label}</div>
          <div className="font-mono text-[11px] text-t-2">{key.lastUsed}</div>
          <button
            onClick={() => handleRevoke(key.id)}
            className="font-mono text-[11px] text-red border border-red/30 px-3 py-1 hover:bg-red/10 transition-colors"
          >
            revoke
          </button>
        </div>
      ))}

      {loadState === 'done' && keys.length === 0 && (
        <div className="px-5 py-6 font-mono text-[12px] text-t-2 text-center">
          No API keys yet. Generate one to get started.
        </div>
      )}

      {/* Revealed key banner */}
      {revealedKey && (
        <div className="mx-5 my-3 bg-accent/5 border border-accent/25 px-4 py-3 flex flex-col gap-2">
          <div className="font-mono text-[10px] text-amber tracking-[0.06em] uppercase">
            Copy this key now — it will not be shown again
          </div>
          <div className="flex items-center gap-2">
            <div className="font-mono text-[11px] text-accent bg-bg-2 border border-border px-3 py-1.5 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {revealedKey.fullKey}
            </div>
            <button
              onClick={handleCopyKey}
              className="bg-accent text-bg-0 font-mono text-xs font-medium px-3 py-1.5 hover:bg-accent-2 transition-colors flex-shrink-0"
            >
              {copiedKey ? 'copied!' : 'copy'}
            </button>
          </div>
        </div>
      )}

      {/* Create new key form */}
      <div className="border-t border-border px-5 py-4">
        <div className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase mb-3">Create New Key</div>
        <form onSubmit={handleCreate} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="font-mono text-[10px] text-t-2 block mb-1">Label</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. production"
              className="w-full bg-bg-2 border border-border text-t-0 font-mono text-sm px-3 py-2 focus:border-accent focus:outline-none placeholder-t-3"
            />
          </div>
          <button
            type="submit"
            disabled={createState === 'loading' || !newLabel.trim()}
            className="bg-accent text-bg-0 font-mono text-xs font-medium px-5 py-2 hover:bg-accent-2 transition-colors disabled:opacity-50"
          >
            {createState === 'loading' ? 'creating...' : '+ create key'}
          </button>
        </form>
      </div>
    </div>
  );
}
