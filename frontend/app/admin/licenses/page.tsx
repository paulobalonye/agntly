'use client';

import { useState, useEffect } from 'react';

interface License {
  id: string;
  purchaseCode: string;
  buyerEmail: string | null;
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

export default function AdminLicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function loadLicenses() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/licenses');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setLicenses(
          json.data.map((l: Record<string, unknown>) => ({
            id: String(l.id ?? ''),
            purchaseCode: String(l.purchaseCode ?? l.purchase_code ?? ''),
            buyerEmail: l.buyerEmail ?? l.buyer_email ? String(l.buyerEmail ?? l.buyer_email) : null,
            domain: l.domain ? String(l.domain) : null,
            licenseType: String(l.licenseType ?? l.license_type ?? 'regular'),
            envatoBuyer: l.envatoBuyer ?? l.envato_buyer ? String(l.envatoBuyer ?? l.envato_buyer) : null,
            status: String(l.status ?? 'active'),
            activatedAt: l.activatedAt ?? l.activated_at ? String(l.activatedAt ?? l.activated_at) : null,
            createdAt: String(l.createdAt ?? l.created_at ?? ''),
          })),
        );
        setTotal(json.meta?.total ?? json.data.length);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { loadLicenses(); }, []);

  async function handleRevoke(purchaseCode: string) {
    if (!confirm(`Revoke license ${purchaseCode.slice(0, 8)}...? This cannot be undone.`)) return;
    setRevoking(purchaseCode);
    try {
      await fetch('/api/admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', purchaseCode }),
      });
      await loadLicenses();
    } catch { /* ignore */ }
    setRevoking(null);
  }

  const activeCount = licenses.filter((l) => l.status === 'active' && l.domain).length;
  const revokedCount = licenses.filter((l) => l.status === 'revoked').length;

  return (
    <main className="relative z-10 min-h-screen px-8 py-8 max-w-[1400px] mx-auto">
      <div className="mb-8">
        <div className="font-mono text-[11px] text-red tracking-[0.1em] uppercase mb-2">admin</div>
        <h1 className="font-display text-[32px] font-semibold text-t-0 leading-tight">Licenses</h1>
        <p className="font-mono text-[12px] text-t-2 mt-1">
          {total} total · {activeCount} active · {revokedCount} revoked
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 justify-center">
          <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          <span className="font-mono text-[12px] text-t-2">Loading licenses...</span>
        </div>
      ) : (
        <div className="bg-bg-1 border border-border overflow-hidden">
          <div
            className="grid bg-bg-2 border-b border-border px-5 py-3"
            style={{ gridTemplateColumns: '2fr 1.5fr 1fr 80px 100px 100px 80px' }}
          >
            {['Purchase Code', 'Domain', 'Buyer', 'Type', 'Status', 'Activated', 'Actions'].map((col) => (
              <div key={col} className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase">{col}</div>
            ))}
          </div>

          {licenses.map((lic) => (
            <div
              key={lic.id}
              className="grid px-5 py-3 border-b border-border last:border-b-0 items-center hover:bg-bg-2/50 transition-colors"
              style={{ gridTemplateColumns: '2fr 1.5fr 1fr 80px 100px 100px 80px' }}
            >
              <div className="font-mono text-[11px] text-t-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {truncate(lic.purchaseCode, 20)}
              </div>
              <div className="font-mono text-[12px] text-accent overflow-hidden text-ellipsis whitespace-nowrap">
                {lic.domain ?? '— not activated —'}
              </div>
              <div className="font-mono text-[11px] text-t-2 overflow-hidden text-ellipsis whitespace-nowrap">
                {lic.envatoBuyer ?? lic.buyerEmail ?? '—'}
              </div>
              <div className="font-mono text-[10px] text-t-1">{lic.licenseType}</div>
              <div>
                <span className={`inline-block font-mono text-[10px] px-2 py-[2px] ${statusPill(lic.status)}`}>
                  {lic.status}
                </span>
              </div>
              <div className="font-mono text-[10px] text-t-2">{formatDate(lic.activatedAt)}</div>
              <div>
                {lic.status === 'active' && (
                  <button
                    onClick={() => handleRevoke(lic.purchaseCode)}
                    disabled={revoking === lic.purchaseCode}
                    className="font-mono text-[10px] px-2 py-1 border border-red/30 text-red hover:bg-red/10 transition-colors disabled:opacity-50"
                  >
                    {revoking === lic.purchaseCode ? '...' : 'revoke'}
                  </button>
                )}
              </div>
            </div>
          ))}

          {licenses.length === 0 && (
            <div className="px-5 py-8 text-center font-mono text-[12px] text-t-2">
              No licenses found. Licenses are created when buyers activate their purchase code.
            </div>
          )}
        </div>
      )}
    </main>
  );
}
