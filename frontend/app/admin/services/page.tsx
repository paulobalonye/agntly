'use client';

import { PlatformHealth } from '@/components/admin/PlatformHealth';
import { TreasuryOverview, type TreasuryData } from '@/components/admin/TreasuryOverview';
import { useState, useEffect } from 'react';

export default function AdminServicesPage() {
  const [treasury, setTreasury] = useState<TreasuryData>({
    totalWallets: 0, totalBalance: '0.00', totalLocked: '0.00',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then((json) => {
        if (json?.data?.wallets) {
          setTreasury({
            totalWallets: json.data.wallets.totalWallets ?? 0,
            totalBalance: json.data.wallets.totalBalance ?? '0.00',
            totalLocked: json.data.wallets.totalLocked ?? '0.00',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="relative z-10 min-h-screen px-8 py-8 max-w-[1400px] mx-auto">
      <div className="mb-8">
        <div className="font-mono text-[11px] text-red tracking-[0.1em] uppercase mb-2">admin</div>
        <h1 className="font-display text-[32px] font-semibold text-t-0 leading-tight">Services & Infrastructure</h1>
        <p className="font-mono text-[12px] text-t-2 mt-1">Monitor microservice health and platform treasury</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 justify-center">
          <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          <span className="font-mono text-[12px] text-t-2">Loading...</span>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase pb-3 border-b border-border mb-4">
              Service Health
            </h2>
            <PlatformHealth />
          </section>

          <section>
            <h2 className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase pb-3 border-b border-border mb-4">
              Treasury
            </h2>
            <TreasuryOverview data={treasury} />
          </section>
        </div>
      )}
    </main>
  );
}
