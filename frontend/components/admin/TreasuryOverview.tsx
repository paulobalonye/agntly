export interface TreasuryData {
  totalWallets: number;
  totalBalance: string;
  totalLocked: string;
  platformRevenue?: string;
}

export function TreasuryOverview({ data }: { data: TreasuryData }) {
  const balance = parseFloat(data.totalBalance || '0');
  const locked = parseFloat(data.totalLocked || '0');
  const total = balance + locked;
  const revenue = parseFloat(data.platformRevenue || '0');

  return (
    <div className="bg-bg-1 border border-border p-5">
      <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-4">
        Treasury
      </div>

      <div className="flex flex-col gap-4">
        {/* Platform Revenue — the 3% fee */}
        <div className="bg-accent/5 border border-accent/20 p-3">
          <div className="font-mono text-[10px] text-accent mb-1">Platform Revenue (3% fees)</div>
          <div className="font-mono text-[24px] font-medium text-accent leading-none">
            ${revenue.toFixed(2)}
          </div>
          <div className="font-mono text-[10px] text-t-2 mt-1">USDC earned from transaction fees</div>
        </div>

        <div>
          <div className="font-mono text-[10px] text-t-2 mb-1">Total Platform Value</div>
          <div className="font-mono text-[20px] font-medium text-t-0 leading-none">
            ${total.toFixed(2)}
          </div>
          <div className="font-mono text-[10px] text-t-2 mt-1">
            across {data.totalWallets} wallets
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-bg-2 border border-border p-3">
            <div className="font-mono text-[10px] text-t-2 mb-1">Available</div>
            <div className="font-mono text-[16px] text-accent font-medium">
              ${balance.toFixed(2)}
            </div>
          </div>
          <div className="bg-bg-2 border border-border p-3">
            <div className="font-mono text-[10px] text-t-2 mb-1">In Escrow</div>
            <div className="font-mono text-[16px] text-amber font-medium">
              ${locked.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
