'use client';

import { useState, useEffect } from 'react';

interface ServiceStatus {
  name: string;
  port: number;
  status: 'online' | 'offline' | 'checking';
}

const SERVICES: Omit<ServiceStatus, 'status'>[] = [
  { name: 'api-gateway', port: 3000 },
  { name: 'auth-service', port: 3001 },
  { name: 'wallet-service', port: 3002 },
  { name: 'escrow-engine', port: 3003 },
  { name: 'task-service', port: 3004 },
  { name: 'registry-service', port: 3005 },
  { name: 'payment-service', port: 3006 },
  { name: 'webhook-service', port: 3007 },
  { name: 'settlement-worker', port: 3008 },
  { name: 'echo-agent', port: 4000 },
];

export function PlatformHealth() {
  const [services, setServices] = useState<ServiceStatus[]>(
    SERVICES.map((s) => ({ ...s, status: 'checking' as const })),
  );

  useEffect(() => {
    async function checkHealth() {
      const results = await Promise.all(
        SERVICES.map(async (svc) => {
          try {
            const res = await fetch(`/api/admin/health?port=${svc.port}`, {
              signal: AbortSignal.timeout(5000),
            });
            const data = await res.json();
            return { ...svc, status: data.ok ? 'online' as const : 'offline' as const };
          } catch {
            return { ...svc, status: 'offline' as const };
          }
        }),
      );
      setServices(results);
    }
    checkHealth();
    const interval = setInterval(checkHealth, 30_000);
    return () => clearInterval(interval);
  }, []);

  const onlineCount = services.filter((s) => s.status === 'online').length;

  return (
    <div className="bg-bg-1 border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase">
          Service Health
        </div>
        <div className="font-mono text-[11px] text-t-1">
          {onlineCount}/{services.length} online
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {services.map((svc) => (
          <div
            key={svc.name}
            className="flex items-center justify-between bg-bg-2 border border-border px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-[6px] h-[6px] rounded-full ${
                  svc.status === 'online'
                    ? 'bg-accent'
                    : svc.status === 'checking'
                    ? 'bg-amber animate-pulse'
                    : 'bg-red'
                }`}
              />
              <span className="font-mono text-[11px] text-t-0">{svc.name}</span>
            </div>
            <span className="font-mono text-[10px] text-t-2">:{svc.port}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
