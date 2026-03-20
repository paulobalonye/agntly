'use client';

import { useState } from 'react';

interface Withdrawal {
  id: string;
  amount: string;
  destination: string;
  status: string;
  txHash: string | null;
  date: string;
}

interface WalletData {
  balance: string;
  locked: string;
  address: string;
  withdrawals: Withdrawal[];
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getWithdrawalStatusPill(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-accent/10 text-accent border border-accent/25';
    case 'processing':
      return 'bg-blue/10 text-blue border border-blue/25';
    case 'queued':
    default:
      return 'bg-t-2/15 text-t-2 border border-border';
  }
}

interface WalletSectionProps {
  wallet: WalletData;
}

export function WalletSection({ wallet }: WalletSectionProps) {
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [copied, setCopied] = useState(false);

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !destination) return;
    setSubmitState('loading');

    try {
      const res = await fetch('/api/dashboard/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, destination }),
      });
      const json = await res.json();
      setSubmitState(json.success ? 'success' : 'error');
    } catch {
      setSubmitState('error');
    }
  }

  function handleCopyAddress() {
    navigator.clipboard.writeText(wallet.address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Balance card */}
      <div className="bg-bg-1 border border-border p-5">
        <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-3">Balance</div>
        <div className="font-mono text-[28px] font-medium text-accent leading-none mb-1">
          {wallet.balance}
          <span className="text-[14px] text-t-2 ml-2">USDC</span>
        </div>
        <div className="font-mono text-[11px] text-t-2 mb-4">
          {wallet.locked} USDC locked in escrow
        </div>
        <div className="flex items-center gap-2">
          <div className="font-mono text-[11px] text-t-1 bg-bg-2 border border-border px-3 py-1.5 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
            {truncateAddress(wallet.address)}
          </div>
          <button
            onClick={handleCopyAddress}
            className="bg-transparent border border-border text-t-2 font-mono text-[11px] px-3 py-1.5 hover:border-accent hover:text-accent transition-all flex-shrink-0"
          >
            {copied ? 'copied' : 'copy'}
          </button>
        </div>
      </div>

      {/* Withdraw form */}
      <div className="bg-bg-1 border border-border p-5">
        <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-3">Withdraw</div>
        <form onSubmit={handleWithdraw} className="flex flex-col gap-3">
          <div>
            <label className="font-mono text-[10px] text-t-2 block mb-1">Amount (USDC)</label>
            <input
              type="number"
              step="0.000001"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.000000"
              className="w-full bg-bg-2 border border-border text-t-0 font-mono text-sm px-3 py-2 focus:border-accent focus:outline-none placeholder-t-3"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] text-t-2 block mb-1">Destination Address</label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="0x..."
              className="w-full bg-bg-2 border border-border text-t-0 font-mono text-sm px-3 py-2 focus:border-accent focus:outline-none placeholder-t-3"
            />
          </div>
          <button
            type="submit"
            disabled={submitState === 'loading'}
            className="bg-accent text-bg-0 font-mono text-xs font-medium px-4 py-2 hover:bg-accent-2 transition-colors disabled:opacity-50"
          >
            {submitState === 'loading' ? 'submitting...' : 'withdraw'}
          </button>
          {submitState === 'success' && (
            <div className="font-mono text-[11px] text-accent">Withdrawal queued successfully.</div>
          )}
          {submitState === 'error' && (
            <div className="font-mono text-[11px] text-red">Withdrawal failed. Please try again.</div>
          )}
        </form>
      </div>

      {/* Recent withdrawals */}
      <div className="bg-bg-1 border border-border overflow-hidden">
        <div className="bg-bg-2 border-b border-border px-4 py-3">
          <div className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase">Recent Withdrawals</div>
        </div>
        {wallet.withdrawals.map((wd) => (
          <div
            key={wd.id}
            className="px-4 py-3 border-b border-border last:border-b-0 flex items-center justify-between gap-3"
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="font-mono text-[12px] text-accent">{wd.amount} USDC</div>
              <div className="font-mono text-[10px] text-t-2 overflow-hidden text-ellipsis whitespace-nowrap">
                → {wd.destination}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span
                className={`font-mono text-[10px] px-2 py-[2px] tracking-[0.06em] ${getWithdrawalStatusPill(wd.status)}`}
              >
                {wd.status}
              </span>
              <div className="font-mono text-[10px] text-t-3">{wd.date}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
