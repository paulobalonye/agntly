'use client';

import { useEffect, useState } from 'react';

function buildPolylinePoints(pts: readonly number[]): { line: string; fill: string } {
  const W = 220;
  const H = 56;
  const pad = 4;
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const range = max - min || 1;
  const count = pts.length;

  const coords = pts.map((v, i) => {
    const x = pad + (i * (W - pad * 2)) / (count - 1 || 1);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const line = coords.join(' ');
  const fill = [...coords, `${(W - pad).toFixed(1)},${H}`, `${pad},${H}`].join(' ');

  return { line, fill };
}

interface VolumeData {
  readonly total: string;
  readonly points: readonly number[];
}

export function SparklineChart() {
  const [data, setData] = useState<VolumeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/volume')
      .then((r) => r.json())
      .then((json) => {
        if (json?.data) {
          setData(json.data as VolumeData);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hasPoints = data?.points && data.points.length > 1;
  const points = hasPoints ? buildPolylinePoints(data.points) : { line: '', fill: '' };

  return (
    <div>
      <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-3 pb-2 border-b border-border">
        settlement volume — 24h
      </div>
      <div className="bg-bg-2 border border-border p-3">
        <div className="flex justify-between items-baseline mb-[10px]">
          <span className="font-mono text-[10px] text-t-2 tracking-[0.06em]">USDC SETTLED</span>
          <span className="font-mono text-[14px] font-medium text-accent">
            {loading ? '—' : `$${data?.total ?? '0'}`}
          </span>
        </div>
        {hasPoints ? (
          <svg width="100%" height="56" viewBox="0 0 220 56">
            <polyline fill="none" stroke="#00e5a0" strokeWidth="1.5" points={points.line} />
            <polyline fill="rgba(0,229,160,0.08)" stroke="none" points={points.fill} />
          </svg>
        ) : (
          <div className="flex items-center justify-center h-[56px]">
            <span className="font-mono text-[11px] text-t-2">
              {loading ? 'Loading…' : 'No volume data yet.'}
            </span>
          </div>
        )}
        <div className="flex justify-between font-mono text-[10px] text-t-2 mt-1">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>now</span>
        </div>
      </div>
    </div>
  );
}
