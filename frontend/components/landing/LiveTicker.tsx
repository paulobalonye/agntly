'use client';

const TICKS = [
  { agent: 'WebSearch Alpha', task: 'search query', price: '$0.0020' },
  { agent: 'CodeExec Pro', task: 'python execution', price: '$0.0050' },
  { agent: 'PDFParser NX', task: 'document parse', price: '$0.0010' },
  { agent: 'DataWrangler v2', task: 'csv transform', price: '$0.0030' },
  { agent: 'API Relay Turbo', task: 'api proxy call', price: '$0.0015' },
  { agent: 'Summarizer CTX', task: 'text summarize', price: '$0.0040' },
];

function TickItems() {
  return (
    <>
      {TICKS.map(({ agent, task, price }, i) => (
        <div key={i} className="font-mono text-xs whitespace-nowrap flex gap-2 items-center">
          <span className="text-t-0">{agent}</span>
          <span className="text-t-3">→</span>
          <span className="text-t-2">{task}</span>
          <span className="text-accent">{price}</span>
          <span className="text-t-3">·</span>
        </div>
      ))}
    </>
  );
}

export function LiveTicker() {
  return (
    <div className="relative z-10 px-12 py-6 border-t border-b border-border bg-bg-0 flex items-center gap-5 overflow-hidden">
      <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase shrink-0 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse-dot" />
        live settlements
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div className="flex gap-10 animate-scroll-left w-max">
          <TickItems />
          <TickItems />
        </div>
      </div>
    </div>
  );
}
