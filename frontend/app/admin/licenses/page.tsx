'use client';

import { useState, useEffect } from 'react';

interface License {
  id: string;
  purchaseCode: string;
  buyerEmail: string | null;
  buyerName: string | null;
  domain: string | null;
  licenseType: string;
  envatoBuyer: string | null;
  status: string;
  activatedAt: string | null;
  createdAt: string;
}

function statusPill(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-accent/10 text-accent border border-accent/25';
    case 'revoked':
      return 'bg-red/10 text-red border border-red/25';
    case 'expired':
      return 'bg-amber/10 text-amber border border-amber/25';
    default:
      return 'bg-t-2/15 text-t-2 border border-border';
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function truncate(s: string, len = 16): string {
  if (s.length <= len) return s;
  return s.slice(0, len) + '...';
}

function mapLicense(l: Record<string, unknown>): License {
  return {
    id: String(l.id ?? ''),
    purchaseCode: String(l.purchaseCode ?? l.purchase_code ?? ''),
    buyerEmail: l.buyerEmail ?? l.buyer_email ? String(l.buyerEmail ?? l.buyer_email) : null,
    buyerName: l.buyerName ?? l.buyer_name ? String(l.buyerName ?? l.buyer_name) : null,
    domain: l.domain ? String(l.domain) : null,
    licenseType: String(l.licenseType ?? l.license_type ?? 'regular'),
    envatoBuyer: l.envatoBuyer ?? l.envato_buyer ? String(l.envatoBuyer ?? l.envato_buyer) : null,
    status: String(l.status ?? 'active'),
    activatedAt: l.activatedAt ?? l.activated_at ? String(l.activatedAt ?? l.activated_at) : null,
    createdAt: String(l.createdAt ?? l.created_at ?? ''),
  };
}

// ── Create License Modal ───────────────────────────────────
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [type, setType] = useState('regular');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function generateCode() {
    const hex = () => Math.random().toString(16).slice(2, 10);
    const short = () => Math.random().toString(16).slice(2, 6);
    setCode(`${hex()}-${short()}-${short()}-${short()}-${hex()}${short()}`);
  }

  async function handleCreate() {
    if (!code) { setError('Purchase code is required'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          purchaseCode: code,
          buyerEmail: email || undefined,
          buyerName: name || undefined,
          domain: domain || undefined,
          licenseType: type,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onCreated();
        onClose();
      } else {
        setError(data.error ?? 'Failed to create license');
      }
    } catch {
      setError('Network error');
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-0/80 backdrop-blur-sm">
      <div className="bg-bg-1 border border-border p-8 w-full max-w-lg">
        <h2 className="font-display text-lg font-semibold text-t-0 mb-4">Create License</h2>

        <div className="flex flex-col gap-3">
          <div>
            <label className="font-mono text-[10px] text-t-2 block mb-1 uppercase tracking-wider">Purchase Code</label>
            <div className="flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="flex-1 bg-bg-2 border border-border text-t-0 font-mono text-sm px-3 py-2 focus:border-accent focus:outline-none placeholder-t-3" />
              <button onClick={generateCode} className="bg-bg-2 border border-border text-t-1 font-mono text-[10px] px-3 hover:border-accent hover:text-accent transition-all">generate</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10px] text-t-2 block mb-1 uppercase tracking-wider">Buyer Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="buyer@email.com"
                className="w-full bg-bg-2 border border-border text-t-0 font-mono text-sm px-3 py-2 focus:border-accent focus:outline-none placeholder-t-3" />
            </div>
            <div>
              <label className="font-mono text-[10px] text-t-2 block mb-1 uppercase tracking-wider">Buyer Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe"
                className="w-full bg-bg-2 border border-border text-t-0 font-mono text-sm px-3 py-2 focus:border-accent focus:outline-none placeholder-t-3" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10px] text-t-2 block mb-1 uppercase tracking-wider">Domain (optional)</label>
              <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com"
                className="w-full bg-bg-2 border border-border text-t-0 font-mono text-sm px-3 py-2 focus:border-accent focus:outline-none placeholder-t-3" />
            </div>
            <div>
              <label className="font-mono text-[10px] text-t-2 block mb-1 uppercase tracking-wider">License Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="w-full bg-bg-2 border border-border text-t-0 font-mono text-sm px-3 py-2 focus:border-accent focus:outline-none">
                <option value="regular">Regular</option>
                <option value="extended">Extended</option>
                <option value="promo">Promo</option>
              </select>
            </div>
          </div>

          {error && <div className="font-mono text-[11px] text-red">{error}</div>}

          <div className="flex gap-3 mt-2">
            <button onClick={handleCreate} disabled={loading}
              className="bg-accent text-bg-0 font-mono text-xs font-medium px-5 py-2 hover:bg-accent-2 transition-colors disabled:opacity-50">
              {loading ? 'creating...' : 'create license'}
            </button>
            <button onClick={onClose} className="border border-border text-t-2 font-mono text-xs px-5 py-2 hover:border-t-1 hover:text-t-1 transition-all">
              cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Edit License Modal ─────────────────────────────────────
function EditModal({ license, onClose, onUpdated }: { license: License; onClose: () => void; onUpdated: () => void }) {
  const [email, setEmail] = useState(license.buyerEmail ?? '');
  const [name, setName] = useState(license.buyerName ?? '');
  const [domain, setDomain] = useState(license.domain ?? '');
  const [type, setType] = useState(license.licenseType);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleUpdate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          purchaseCode: license.purchaseCode,
          buyerEmail: email || undefined,
          buyerName: name || undefined,
          domain: domain || undefined,
          licenseType: type,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onUpdated();
        onClose();
      } else {
        setError(data.error ?? 'Update failed');
      }
    } catch {
      setError('Network error');
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-0/80 backdrop-blur-sm">
      <div className="bg-bg-1 border border-border p-8 w-full max-w-lg">
        <h2 className="font-display text-lg font-semibold text-t-0 mb-1">Edit License</h2>
        <p className="font-mono text-[10px] text-t-2 mb-4">{license.purchaseCode}</p>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10px] text-t-2 block mb-1 uppercase tracking-wider">Buyer Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-bg-2 border border-border text-t-0 font-mono text-sm px-3 py-2 focus:border-accent focus:outline-none placeholder-t-3" />
            </div>
            <div>
              <label className="font-mono text-[10px] text-t-2 block mb-1 uppercase tracking-wider">Buyer Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-bg-2 border border-border text-t-0 font-mono text-sm px-3 py-2 focus:border-accent focus:outline-none placeholder-t-3" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10px] text-t-2 block mb-1 uppercase tracking-wider">Domain</label>
              <input value={domain} onChange={(e) => setDomain(e.target.value)}
                className="w-full bg-bg-2 border border-border text-t-0 font-mono text-sm px-3 py-2 focus:border-accent focus:outline-none placeholder-t-3" />
            </div>
            <div>
              <label className="font-mono text-[10px] text-t-2 block mb-1 uppercase tracking-wider">License Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="w-full bg-bg-2 border border-border text-t-0 font-mono text-sm px-3 py-2 focus:border-accent focus:outline-none">
                <option value="regular">Regular</option>
                <option value="extended">Extended</option>
                <option value="promo">Promo</option>
              </select>
            </div>
          </div>

          {error && <div className="font-mono text-[11px] text-red">{error}</div>}

          <div className="flex gap-3 mt-2">
            <button onClick={handleUpdate} disabled={loading}
              className="bg-accent text-bg-0 font-mono text-xs font-medium px-5 py-2 hover:bg-accent-2 transition-colors disabled:opacity-50">
              {loading ? 'saving...' : 'save changes'}
            </button>
            <button onClick={onClose} className="border border-border text-t-2 font-mono text-xs px-5 py-2 hover:border-t-1 hover:text-t-1 transition-all">
              cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function AdminLicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<License | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function loadLicenses() {
    setLoading(true);
    try {
      const url = search.length >= 2
        ? `/api/admin/licenses?q=${encodeURIComponent(search)}`
        : '/api/admin/licenses';
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        const data = Array.isArray(json.data) ? json.data : [];
        setLicenses(data.map(mapLicense));
        setTotal(json.meta?.total ?? data.length);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { loadLicenses(); }, []);

  async function handleAction(purchaseCode: string, action: 'revoke' | 'deactivate' | 'delete') {
    const labels = { revoke: 'Revoke', deactivate: 'Deactivate (unbind domain)', delete: 'Permanently delete' };
    if (!confirm(`${labels[action]} license ${purchaseCode.slice(0, 12)}...?`)) return;

    setActionLoading(purchaseCode);
    try {
      await fetch('/api/admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, purchaseCode }),
      });
      await loadLicenses();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadLicenses();
  }

  const activeCount = licenses.filter((l) => l.status === 'active' && l.domain).length;
  const revokedCount = licenses.filter((l) => l.status === 'revoked').length;

  return (
    <main className="relative z-10 min-h-screen px-8 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="font-mono text-[11px] text-red tracking-[0.1em] uppercase mb-2">admin</div>
          <h1 className="font-display text-[32px] font-semibold text-t-0 leading-tight">Licenses</h1>
          <p className="font-mono text-[12px] text-t-2 mt-1">
            {total} total · {activeCount} active · {revokedCount} revoked
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-accent text-bg-0 font-mono text-[11px] font-medium px-4 py-2 hover:bg-accent-2 transition-colors mt-4"
        >
          + create license
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="search by code, domain, email..."
          className="flex-1 bg-bg-2 border border-border text-t-0 font-mono text-sm px-3 py-2 focus:border-accent focus:outline-none placeholder-t-3 max-w-md"
        />
        <button type="submit" className="border border-border text-t-1 font-mono text-[11px] px-4 py-2 hover:border-accent hover:text-accent transition-all">
          search
        </button>
        {search && (
          <button type="button" onClick={() => { setSearch(''); setTimeout(loadLicenses, 0); }}
            className="border border-border text-t-2 font-mono text-[11px] px-3 py-2 hover:border-t-1 hover:text-t-1 transition-all">
            clear
          </button>
        )}
      </form>

      {loading ? (
        <div className="flex items-center gap-2 py-16 justify-center">
          <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          <span className="font-mono text-[12px] text-t-2">Loading licenses...</span>
        </div>
      ) : (
        <div className="bg-bg-1 border border-border overflow-hidden">
          <div
            className="grid bg-bg-2 border-b border-border px-5 py-3"
            style={{ gridTemplateColumns: '1.8fr 1.5fr 1fr 80px 80px 100px 160px' }}
          >
            {['Purchase Code', 'Domain', 'Buyer', 'Type', 'Status', 'Activated', 'Actions'].map((col) => (
              <div key={col} className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase">{col}</div>
            ))}
          </div>

          {licenses.map((lic) => (
            <div
              key={lic.id}
              className="grid px-5 py-3 border-b border-border last:border-b-0 items-center hover:bg-bg-2/50 transition-colors"
              style={{ gridTemplateColumns: '1.8fr 1.5fr 1fr 80px 80px 100px 160px' }}
            >
              <div className="font-mono text-[11px] text-t-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {truncate(lic.purchaseCode, 20)}
              </div>
              <div className="font-mono text-[12px] text-accent overflow-hidden text-ellipsis whitespace-nowrap">
                {lic.domain ?? '— not bound —'}
              </div>
              <div className="font-mono text-[11px] text-t-2 overflow-hidden text-ellipsis whitespace-nowrap">
                {lic.buyerName ?? lic.buyerEmail ?? lic.envatoBuyer ?? '—'}
              </div>
              <div className="font-mono text-[10px] text-t-1">{lic.licenseType}</div>
              <div>
                <span className={`inline-block font-mono text-[10px] px-2 py-[2px] ${statusPill(lic.status)}`}>
                  {lic.status}
                </span>
              </div>
              <div className="font-mono text-[10px] text-t-2">{formatDate(lic.activatedAt)}</div>
              <div className="flex gap-1">
                <button
                  onClick={() => setEditing(lic)}
                  className="font-mono text-[10px] px-2 py-1 border border-border text-t-1 hover:border-accent hover:text-accent transition-colors"
                >
                  edit
                </button>
                {lic.status === 'active' && lic.domain && (
                  <button
                    onClick={() => handleAction(lic.purchaseCode, 'deactivate')}
                    disabled={actionLoading === lic.purchaseCode}
                    className="font-mono text-[10px] px-2 py-1 border border-amber/30 text-amber hover:bg-amber/10 transition-colors disabled:opacity-50"
                  >
                    unbind
                  </button>
                )}
                {lic.status === 'active' && (
                  <button
                    onClick={() => handleAction(lic.purchaseCode, 'revoke')}
                    disabled={actionLoading === lic.purchaseCode}
                    className="font-mono text-[10px] px-2 py-1 border border-red/30 text-red hover:bg-red/10 transition-colors disabled:opacity-50"
                  >
                    revoke
                  </button>
                )}
                <button
                  onClick={() => handleAction(lic.purchaseCode, 'delete')}
                  disabled={actionLoading === lic.purchaseCode}
                  className="font-mono text-[10px] px-2 py-1 border border-red/30 text-red hover:bg-red/10 transition-colors disabled:opacity-50"
                >
                  del
                </button>
              </div>
            </div>
          ))}

          {licenses.length === 0 && (
            <div className="px-5 py-8 text-center font-mono text-[12px] text-t-2">
              {search ? 'No licenses match your search.' : 'No licenses yet. Create one or wait for buyer activations.'}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={loadLicenses} />}
      {editing && <EditModal license={editing} onClose={() => setEditing(null)} onUpdated={loadLicenses} />}
    </main>
  );
}
