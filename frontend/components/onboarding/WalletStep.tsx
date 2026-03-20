'use client';

import { useState } from 'react';

interface WalletStepProps {
  onComplete: () => void;
}

export function WalletStep({ onComplete: _onComplete }: WalletStepProps) {
  const [address, setAddress] = useState('');
  const [walletCreated, setWalletCreated] = useState(false);

  function handleAutoCreate() {
    setWalletCreated(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Paste existing wallet address (optional)"
          className="flex-1 bg-bg-2 border border-border text-t-0 font-mono text-xs px-4 py-3 outline-none focus:border-accent transition-colors placeholder:text-t-3"
        />
        <button
          onClick={handleAutoCreate}
          className="bg-accent text-bg-0 font-mono text-xs font-medium px-4 py-3 hover:bg-accent-2 transition-colors whitespace-nowrap"
        >
          auto-create
        </button>
      </div>

      <div className="font-mono text-[11px] text-t-2 leading-relaxed p-3 bg-bg-2 border border-border border-l-2 border-l-accent">
        Auto-created wallets use ERC-4337 account abstraction on Base L2.{' '}
        No seed phrase. Funds controlled by your API key. Withdraw to any address anytime.{' '}
        <span className="text-accent">$0 to create · gas fees paid by Agntly on first task.</span>
      </div>

      {walletCreated && (
        <div className="p-3 border border-accent/20 bg-accent/[0.06]">
          <div className="font-mono text-[10px] text-accent mb-1.5 tracking-[0.06em]">
            WALLET CREATED
          </div>
          <div className="font-mono text-xs text-t-0">0xA9c3…4D77</div>
          <div className="font-mono text-[10px] text-t-2 mt-1">Balance: 0.0000 USDC · Base L2</div>
        </div>
      )}
    </div>
  );
}
