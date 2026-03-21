'use client';

import { useState, useEffect } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

interface WalletData {
  id: string;
  balance: string;
  locked: string;
  address: string;
  chain: string;
}

const DEFAULT_WALLET: WalletData = {
  id: '',
  balance: '0.000000',
  locked: '0.000000',
  address: '—',
  chain: 'Base Sepolia',
};

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: string;
  counterparty: string;
  status: 'completed' | 'processing' | 'queued' | 'failed';
  date: string;
  txHash: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

const EIP55_RE = /^0x[0-9a-fA-F]{40}$/;

function isValidEthAddress(addr: string): boolean {
  return EIP55_RE.test(addr);
}

function statusPill(status: Transaction['status']): string {
  switch (status) {
    case 'completed':
      return 'bg-accent/10 text-accent border border-accent/25';
    case 'processing':
      return 'bg-blue/10 text-blue border border-blue/25';
    case 'queued':
      return 'bg-t-2/15 text-t-2 border border-border';
    case 'failed':
      return 'bg-red/10 text-red border border-red/25';
  }
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface BalanceCardProps {
  wallet: WalletData;
}

function BalanceCard({ wallet }: BalanceCardProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(wallet.address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-bg-1 border border-border p-6">
      <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-4">Balance</div>

      <div className="font-mono text-[40px] font-medium text-accent leading-none mb-1">
        ${wallet.balance}
        <span className="text-[16px] text-t-2 ml-2">USDC</span>
      </div>
      <div className="font-mono text-[12px] text-t-2 mb-5">
        ${wallet.locked} USDC locked in escrow
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-4 text-[11px] font-mono text-t-2 mb-5">
        <span>chain</span>
        <span className="text-t-1">{wallet.chain}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="font-mono text-[12px] text-t-1 bg-bg-2 border border-border px-3 py-2 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {truncateAddress(wallet.address)}
        </div>
        <button
          onClick={handleCopy}
          className="bg-transparent border border-border text-t-2 font-mono text-[11px] px-4 py-2 hover:border-accent hover:text-accent transition-all flex-shrink-0"
        >
          {copied ? 'copied!' : 'copy'}
        </button>
      </div>
    </div>
  );
}

interface FundWalletSectionProps {
  wallet: WalletData;
}

function FundWalletSection({ wallet }: FundWalletSectionProps) {
  const [mode, setMode] = useState<'idle' | 'card' | 'direct'>('idle');
  const [cardAmount, setCardAmount] = useState('');
  const [cardState, setCardState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [cardError, setCardError] = useState('');

  async function handleCardFund(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet.id) {
      setCardError('Wallet not loaded yet. Please wait or refresh.');
      return;
    }
    const parsed = parseFloat(cardAmount);
    if (!cardAmount || isNaN(parsed) || parsed <= 0) {
      setCardError('Enter a valid amount greater than 0.');
      return;
    }
    setCardError('');
    setCardState('loading');

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId: wallet.id, amountUsd: parsed, method: 'card' }),
      });
      const data = await res.json();
      if (data.success && data.data?.checkoutUrl) {
        window.location.href = data.data.checkoutUrl; // Redirect to Stripe
      } else {
        setCardState('error');
        setCardError('Checkout failed: ' + (data.error ?? 'Unknown error'));
      }
    } catch (err) {
      setCardState('error');
      setCardError(err instanceof Error ? err.message : 'Unexpected error.');
    }
  }

  return (
    <div className="bg-bg-1 border border-border p-6">
      <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-4">Fund Wallet</div>

      <div className="flex gap-3 mb-5">
        <button
          onClick={() => setMode(mode === 'card' ? 'idle' : 'card')}
          className={`font-mono text-[12px] px-4 py-2 border transition-all ${
            mode === 'card'
              ? 'bg-accent border-accent text-bg-0'
              : 'border-border text-t-1 hover:border-accent hover:text-accent'
          }`}
        >
          fund with card
        </button>
        <button
          onClick={() => setMode(mode === 'direct' ? 'idle' : 'direct')}
          className={`font-mono text-[12px] px-4 py-2 border transition-all ${
            mode === 'direct'
              ? 'bg-accent border-accent text-bg-0'
              : 'border-border text-t-1 hover:border-accent hover:text-accent'
          }`}
        >
          send USDC directly
        </button>
      </div>

      {mode === 'card' && (
        <form onSubmit={handleCardFund} className="flex flex-col gap-3">
          <div>
            <label className="font-mono text-[10px] text-t-2 block mb-1">Amount (USD)</label>
            <input
              type="number"
              step="0.01"
              min="1"
              value={cardAmount}
              onChange={(e) => setCardAmount(e.target.value)}
              placeholder="50.00"
              className="w-full bg-bg-2 border border-border text-t-0 font-mono text-sm px-3 py-2 focus:border-accent focus:outline-none placeholder-t-3"
            />
          </div>
          {cardError && (
            <div className="font-mono text-[11px] text-red">{cardError}</div>
          )}
          <button
            type="submit"
            disabled={cardState === 'loading'}
            className="bg-accent text-bg-0 font-mono text-xs font-medium px-4 py-2 hover:bg-accent-2 transition-colors disabled:opacity-50 w-fit"
          >
            {cardState === 'loading' ? 'redirecting...' : 'checkout with stripe →'}
          </button>
        </form>
      )}

      {mode === 'direct' && (
        <div className="flex flex-col gap-2">
          <div className="font-mono text-[11px] text-t-2">
            Send USDC (Base Sepolia) to this address:
          </div>
          <div className="bg-bg-2 border border-border px-3 py-2 font-mono text-[12px] text-accent break-all">
            {wallet.address}
          </div>
          <div className="font-mono text-[10px] text-t-2">
            Only send USDC on Base Sepolia. Other assets or networks will be lost.
          </div>
        </div>
      )}
    </div>
  );
}

interface WithdrawSectionProps {
  wallet: WalletData;
}

function WithdrawSection({ wallet }: WithdrawSectionProps) {
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<{ amount?: string; destination?: string; form?: string }>({});

  function validate(): boolean {
    const next: typeof errors = {};
    const parsed = parseFloat(amount);

    if (!amount || isNaN(parsed) || parsed <= 0) {
      next.amount = 'Enter a valid amount greater than 0.';
    } else if (parsed > parseFloat(wallet.balance)) {
      next.amount = 'Amount exceeds available balance.';
    }

    if (!destination) {
      next.destination = 'Destination address is required.';
    } else if (!isValidEthAddress(destination)) {
      next.destination = 'Invalid EIP-55 address format (must start with 0x and be 42 chars).';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitState('loading');
    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId: wallet.id, amount, destination }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitState('success');
        setAmount('');
        setDestination('');
        setErrors({});
      } else {
        setErrors({ form: json.error ?? 'Withdrawal failed.' });
        setSubmitState('error');
      }
    } catch {
      setErrors({ form: 'Network error. Please try again.' });
      setSubmitState('error');
    }
  }

  return (
    <div className="bg-bg-1 border border-border p-6">
      <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-4">Withdraw</div>

      <form onSubmit={handleWithdraw} className="flex flex-col gap-4">
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
          {errors.amount && (
            <div className="font-mono text-[10px] text-red mt-1">{errors.amount}</div>
          )}
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
          {errors.destination && (
            <div className="font-mono text-[10px] text-red mt-1">{errors.destination}</div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={submitState === 'loading'}
            className="bg-accent text-bg-0 font-mono text-xs font-medium px-5 py-2 hover:bg-accent-2 transition-colors disabled:opacity-50"
          >
            {submitState === 'loading' ? 'submitting...' : 'withdraw'}
          </button>
          {submitState === 'success' && (
            <div className="font-mono text-[11px] text-accent">Withdrawal queued successfully.</div>
          )}
          {errors.form && (
            <div className="font-mono text-[11px] text-red">{errors.form}</div>
          )}
        </div>
      </form>
    </div>
  );
}

function normalizeTransaction(raw: Record<string, unknown>): Transaction {
  return {
    id: String(raw.id ?? ''),
    type: (raw.type as Transaction['type']) ?? 'deposit',
    amount: String(raw.amount ?? '0.000000'),
    counterparty: String(raw.counterparty ?? raw.from ?? raw.to ?? ''),
    status: (raw.status as Transaction['status']) ?? 'completed',
    date: String(raw.date ?? raw.createdAt ?? ''),
    txHash: raw.txHash ? String(raw.txHash) : null,
  };
}

function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/dashboard/wallet')
      .then((r) => r.json())
      .then((json) => {
        const list: unknown[] = json?.data?.transactions ?? json?.transactions ?? json?.data ?? [];
        if (Array.isArray(list) && list.length > 0) {
          setTransactions(list.map((t) => normalizeTransaction(t as Record<string, unknown>)));
        }
      })
      .catch(() => {
        // Keep empty on failure
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-bg-1 border border-border overflow-hidden">
      <div className="bg-bg-2 border-b border-border px-5 py-3">
        <div className="font-mono text-[10px] text-t-2 tracking-[0.08em] uppercase">Transaction History</div>
      </div>

      {/* Table header */}
      <div className="grid px-5 py-2 border-b border-border bg-bg-2/50"
           style={{ gridTemplateColumns: '80px 1fr 1fr 100px 120px' }}>
        {['type', 'amount', 'counterparty', 'status', 'date'].map((col) => (
          <div key={col} className="font-mono text-[10px] text-t-2 tracking-[0.06em] uppercase">
            {col}
          </div>
        ))}
      </div>

      {loading && (
        <div className="px-5 py-8 font-mono text-[12px] text-t-2 text-center">Loading…</div>
      )}

      {!loading && transactions.length === 0 && (
        <div className="px-5 py-8 font-mono text-[12px] text-t-2 text-center">
          No transactions yet.
        </div>
      )}

      {transactions.map((tx) => (
        <div
          key={tx.id}
          className="grid px-5 py-3 border-b border-border last:border-b-0 items-center gap-2"
          style={{ gridTemplateColumns: '80px 1fr 1fr 100px 120px' }}
        >
          <div className={`font-mono text-[10px] px-2 py-[2px] w-fit tracking-[0.04em] ${
            tx.type === 'deposit'
              ? 'bg-accent/10 text-accent border border-accent/25'
              : 'bg-t-2/10 text-t-1 border border-border'
          }`}>
            {tx.type}
          </div>
          <div className={`font-mono text-[13px] ${tx.type === 'deposit' ? 'text-accent' : 'text-t-0'}`}>
            {tx.amount} USDC
          </div>
          <div className="font-mono text-[11px] text-t-2 overflow-hidden text-ellipsis whitespace-nowrap">
            {tx.counterparty}
          </div>
          <div>
            <span className={`font-mono text-[10px] px-2 py-[2px] tracking-[0.04em] ${statusPill(tx.status)}`}>
              {tx.status}
            </span>
          </div>
          <div className="font-mono text-[10px] text-t-3">{tx.date}</div>
        </div>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function normalizeWalletData(raw: Record<string, unknown>): WalletData {
  return {
    id: String(raw.id ?? ''),
    balance: String(raw.balance ?? raw.availableBalance ?? DEFAULT_WALLET.balance),
    locked: String(raw.locked ?? raw.lockedBalance ?? DEFAULT_WALLET.locked),
    address: String(raw.address ?? raw.walletAddress ?? DEFAULT_WALLET.address),
    chain: String(raw.chain ?? raw.network ?? DEFAULT_WALLET.chain),
  };
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletData>(DEFAULT_WALLET);

  useEffect(() => {
    fetch('/api/wallet')
      .then((r) => r.json())
      .then((json) => {
        const raw: Record<string, unknown> = json?.data ?? json;
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          setWallet(normalizeWalletData(raw as Record<string, unknown>));
        }
      })
      .catch(() => {
        // Keep default wallet on failure
      });
  }, []);

  return (
    <div className="relative z-[1] min-h-[calc(100vh-52px-58px)] px-8 py-8 max-w-[900px] mx-auto">
      <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-1">wallet</div>
      <h1 className="font-display text-[26px] font-semibold text-t-0 mb-8 leading-tight">
        Wallet
      </h1>

      <div className="flex flex-col gap-6">
        <BalanceCard wallet={wallet} />
        <FundWalletSection wallet={wallet} />
        <WithdrawSection wallet={wallet} />
        <TransactionHistory />
      </div>
    </div>
  );
}
