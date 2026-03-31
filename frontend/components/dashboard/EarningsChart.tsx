'use client';

import { useEffect, useState } from 'react';

interface EarningsDay {
  readonly day: string;
  readonly amount: number;
}

const CHART_WIDTH = 520;
const CHART_HEIGHT = 180;
const PADDING_LEFT = 48;
const PADDING_RIGHT = 16;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 32;

const INNER_WIDTH = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const INNER_HEIGHT = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

interface TooltipState {
  x: number;
  y: number;
  day: string;
  amount: number;
}

export function EarningsChart() {
  const [data, setData] = useState<readonly EarningsDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/earnings')
      .then((r) => r.json())
      .then((json) => {
        const days: EarningsDay[] = Array.isArray(json?.data) ? json.data : [];
        setData(days);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-bg-1 border border-border p-5">
        <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-4">
          Earnings / 14 Days
        </div>
        <div className="flex items-center justify-center" style={{ height: CHART_HEIGHT }}>
          <span className="font-mono text-[12px] text-t-2">Loading…</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-bg-1 border border-border p-5">
        <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-4">
          Earnings / 14 Days
        </div>
        <div className="flex items-center justify-center" style={{ height: CHART_HEIGHT }}>
          <span className="font-mono text-[12px] text-t-2">No earnings data yet.</span>
        </div>
      </div>
    );
  }

  const maxAmount = Math.max(...data.map((d) => d.amount));
  const yMax = Math.ceil(maxAmount / 20) * 20 || 20;
  const barCount = data.length;
  const barGap = 4;
  const barWidth = (INNER_WIDTH - barGap * (barCount - 1)) / barCount;
  const yLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="bg-bg-1 border border-border p-5 relative">
      <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-4">
        Earnings / 14 Days
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="overflow-visible"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Y-axis grid lines */}
        {yLines.map((frac) => {
          const y = PADDING_TOP + INNER_HEIGHT * (1 - frac);
          const label = `$${Math.round(yMax * frac)}`;
          return (
            <g key={frac}>
              <line
                x1={PADDING_LEFT}
                y1={y}
                x2={CHART_WIDTH - PADDING_RIGHT}
                y2={y}
                stroke="#1e2d3d"
                strokeWidth={1}
              />
              <text
                x={PADDING_LEFT - 6}
                y={y + 4}
                fill="#4d6478"
                fontSize={9}
                textAnchor="end"
                fontFamily="IBM Plex Mono, monospace"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((item, i) => {
          const barHeight = (item.amount / yMax) * INNER_HEIGHT;
          const x = PADDING_LEFT + i * (barWidth + barGap);
          const y = PADDING_TOP + INNER_HEIGHT - barHeight;

          return (
            <g key={item.day}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={tooltip?.day === item.day ? '#00b87a' : '#00e5a0'}
                opacity={tooltip && tooltip.day !== item.day ? 0.5 : 1}
                style={{ transition: 'opacity 0.15s, fill 0.15s' }}
                onMouseEnter={(e) => {
                  const svg = (e.target as SVGRectElement).closest('svg');
                  if (!svg) return;
                  const svgRect = svg.getBoundingClientRect();
                  const barCenterX = svgRect.left + ((x + barWidth / 2) / CHART_WIDTH) * svgRect.width;
                  const barTopY = svgRect.top + (y / CHART_HEIGHT) * svgRect.height;
                  setTooltip({
                    x: barCenterX - svgRect.left,
                    y: barTopY - svgRect.top,
                    day: item.day,
                    amount: item.amount,
                  });
                }}
              />
              {/* X-axis label */}
              <text
                x={x + barWidth / 2}
                y={PADDING_TOP + INNER_HEIGHT + 18}
                fill="#4d6478"
                fontSize={8.5}
                textAnchor="middle"
                fontFamily="IBM Plex Mono, monospace"
              >
                {item.day.split(' ').pop()}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-bg-2 border border-border px-3 py-2 font-mono text-[11px] z-10"
          style={{
            left: tooltip.x,
            top: tooltip.y - 48,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="text-t-2 text-[10px]">{tooltip.day}</div>
          <div className="text-accent">${tooltip.amount.toFixed(2)}</div>
        </div>
      )}
    </div>
  );
}
