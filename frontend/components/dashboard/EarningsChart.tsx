'use client';

import { useState } from 'react';

const CHART_DATA = [
  { day: 'Mar 6', amount: 32.5 },
  { day: 'Mar 7', amount: 47.8 },
  { day: 'Mar 8', amount: 29.1 },
  { day: 'Mar 9', amount: 61.3 },
  { day: 'Mar 10', amount: 55.0 },
  { day: 'Mar 11', amount: 18.4 },
  { day: 'Mar 12', amount: 38.7 },
  { day: 'Mar 13', amount: 72.6 },
  { day: 'Mar 14', amount: 43.2 },
  { day: 'Mar 15', amount: 58.9 },
  { day: 'Mar 16', amount: 34.1 },
  { day: 'Mar 17', amount: 66.4 },
  { day: 'Mar 18', amount: 51.7 },
  { day: 'Mar 19', amount: 47.8 },
];

const CHART_WIDTH = 520;
const CHART_HEIGHT = 180;
const PADDING_LEFT = 48;
const PADDING_RIGHT = 16;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 32;

const INNER_WIDTH = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const INNER_HEIGHT = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

const MAX_AMOUNT = Math.max(...CHART_DATA.map((d) => d.amount));
const Y_MAX = Math.ceil(MAX_AMOUNT / 20) * 20;

const BAR_COUNT = CHART_DATA.length;
const BAR_GAP = 4;
const BAR_WIDTH = (INNER_WIDTH - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT;

interface TooltipState {
  x: number;
  y: number;
  day: string;
  amount: number;
}

export function EarningsChart() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

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
          const label = `$${Math.round(Y_MAX * frac)}`;
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
        {CHART_DATA.map((item, i) => {
          const barHeight = (item.amount / Y_MAX) * INNER_HEIGHT;
          const x = PADDING_LEFT + i * (BAR_WIDTH + BAR_GAP);
          const y = PADDING_TOP + INNER_HEIGHT - barHeight;

          return (
            <g key={item.day}>
              <rect
                x={x}
                y={y}
                width={BAR_WIDTH}
                height={barHeight}
                fill={tooltip?.day === item.day ? '#00b87a' : '#00e5a0'}
                opacity={tooltip && tooltip.day !== item.day ? 0.5 : 1}
                style={{ transition: 'opacity 0.15s, fill 0.15s' }}
                onMouseEnter={(e) => {
                  const svg = (e.target as SVGRectElement).closest('svg');
                  if (!svg) return;
                  const svgRect = svg.getBoundingClientRect();
                  const barCenterX = svgRect.left + ((x + BAR_WIDTH / 2) / CHART_WIDTH) * svgRect.width;
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
                x={x + BAR_WIDTH / 2}
                y={PADDING_TOP + INNER_HEIGHT + 18}
                fill="#4d6478"
                fontSize={8.5}
                textAnchor="middle"
                fontFamily="IBM Plex Mono, monospace"
              >
                {item.day.split(' ')[1]}
              </text>
            </g>
          );
        })}

        {/* X-axis month label */}
        <text
          x={PADDING_LEFT}
          y={CHART_HEIGHT}
          fill="#2a3d52"
          fontSize={8}
          fontFamily="IBM Plex Mono, monospace"
        >
          Mar
        </text>
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
