'use client';

import { useEffect, useState } from 'react';

interface ActivityItem {
  agent: string;
  type: 'earn' | 'pay';
  amount: string;
  desc: string;
  time: string;
}

const AGENT_NAMES = [
  'WebSearch Alpha',
  'CodeExec Pro',
  'PDFParser NX',
  'DataWrangler v2',
  'API Relay Turbo',
  'Summarizer CTX',
];

const PRICES = ['0.0020', '0.0050', '0.0010', '0.0030', '0.0015', '0.0040'];

const INITIAL_ACTIVITIES: ActivityItem[] = [
  { agent: 'WebSearch Alpha', type: 'earn', amount: '+$0.0020', desc: 'Task completed · orch-0x4F2A', time: '2s ago' },
  { agent: 'API Relay Turbo', type: 'earn', amount: '+$0.0015', desc: 'Task completed · orch-0xB812', time: '5s ago' },
  { agent: 'PDFParser NX', type: 'pay', amount: '-$0.0010', desc: 'Escrow locked · task_01J...', time: '8s ago' },
  { agent: 'CodeExec Pro', type: 'earn', amount: '+$0.0050', desc: 'Task completed · orch-0x9C01', time: '11s ago' },
  { agent: 'DataWrangler v2', type: 'earn', amount: '+$0.0030', desc: 'Task completed · orch-0xF41D', time: '15s ago' },
];

function randomHex(len: number): string {
  return Math.random().toString(16).slice(2, 2 + len).toUpperCase();
}

function generateItem(): ActivityItem {
  const isEarn = Math.random() > 0.4;
  const price = PRICES[Math.floor(Math.random() * PRICES.length)];
  const agent = AGENT_NAMES[Math.floor(Math.random() * AGENT_NAMES.length)];
  const desc = Math.random() > 0.5
    ? `Task completed · orch-0x${randomHex(4)}`
    : 'Escrow locked · task_01J...';

  return {
    agent,
    type: isEarn ? 'earn' : 'pay',
    amount: isEarn ? `+$${price}` : `-$${price}`,
    desc,
    time: 'just now',
  };
}

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>(INITIAL_ACTIVITIES);

  useEffect(() => {
    const id = setInterval(() => {
      setItems((prev) => {
        const next = [generateItem(), ...prev.slice(0, 4)].map((item, i) => ({
          ...item,
          time: i === 0 ? 'just now' : `${i * 3 + Math.floor(Math.random() * 3)}s ago`,
        }));
        return next;
      });
    }, 3000);

    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-3 pb-2 border-b border-border">
        live settlements
      </div>
      <div className="flex flex-col gap-0">
        {items.map((item, i) => (
          <div
            key={i}
            className="py-[9px] border-b border-border flex flex-col gap-[3px]"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-t-0">{item.agent}</span>
              <span className={`font-mono text-[11px] font-medium ${item.type === 'earn' ? 'text-accent' : 'text-amber'}`}>
                {item.amount}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-t-2">{item.desc}</span>
              <span className="font-mono text-[10px] text-t-2">{item.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
