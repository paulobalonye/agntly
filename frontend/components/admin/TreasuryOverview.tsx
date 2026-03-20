export interface TreasuryData {
  totalWallets: number;
  totalBalance: string;
  totalLocked: string;
}

export function TreasuryOverview({ data }: { data: TreasuryData }) {
  const balance = parseFloat(data.totalBalance || '0');
  const locked = parseFloat(data.totalLocked || '0');
  const total = balance + locked;

  return (
    <div className="bg-bg-1 border border-border p-5">
      <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-4">
        Treasury
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <div className="font-mono text-[10px] text-t-2 mb-1">Total Platform Value</div>
          <div className="font-mono text-[24px] font-medium text-accent leading-none">
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
