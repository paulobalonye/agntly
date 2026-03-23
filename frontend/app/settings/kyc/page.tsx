'use client';

import { useState, useEffect } from 'react';

interface KycStatus {
  tier: string;
  status: string;
  fullName?: string;
  country?: string;
}

interface BankAccount {
  id: string;
  accountNumberMasked: string | null;
  routingNumber: string | null;
  bankName: string;
  status: string;
}

export default function KycPage() {
  const [kyc, setKyc] = useState<KycStatus | null>(null);
  const [bank, setBank] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);

  // Tier 2 form
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('');
  const [dob, setDob] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/kyc').then(r => r.json()).catch(() => null),
      fetch('/api/fiat/bank-account').then(r => r.json()).catch(() => null),
    ]).then(([kycJson, bankJson]) => {
      if (kycJson?.data) setKyc(kycJson.data);
      if (bankJson?.data) setBank(bankJson.data);
      setLoading(false);
    });
  }, []);

  async function handleTier2(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const res = await fetch('/api/kyc/tier2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, country, dateOfBirth: dob }),
      });
      const data = await res.json();
      if (data.success) {
        setKyc(data.data);
        setMessage('KYC verified. You can now create a bank account.');
      } else {
        setMessage(data.error ?? 'Verification failed');
      }
    } catch {
      setMessage('Network error');
    }
    setSubmitting(false);
  }

  async function handleCreateBank() {
    setSubmitting(true);
    setMessage('');
    try {
      const res = await fetch('/api/fiat/bank-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setBank(data.data);
        setMessage('Bank account created.');
      } else {
        setMessage(data.error ?? 'Failed to create bank account');
      }
    } catch {
      setMessage('Network error');
    }
    setSubmitting(false);
  }

  const isVerified = kyc?.status === 'verified';

  return (
    <div className="relative z-[1] min-h-[calc(100vh-52px-58px)] px-8 py-8 max-w-[700px] mx-auto">
      <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-1">settings</div>
      <h1 className="font-display text-[26px] font-semibold text-t-0 mb-8 leading-tight">
        KYC and Banking
      </h1>

      {loading ? (
        <div className="font-mono text-[12px] text-t-2 text-center py-12">Loading...</div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* KYC Status */}
          <div className="bg-bg-1 border border-border p-6">
            <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-4">KYC Verification</div>

            {isVerified ? (
              <div className="bg-accent/5 border border-accent/20 p-4">
                <div className="font-mono text-[10px] text-accent mb-1">VERIFIED</div>
                <div className="font-mono text-[13px] text-t-0">{kyc?.fullName}</div>
                <div className="font-mono text-[11px] text-t-2">{kyc?.country} · Tier {kyc?.tier?.replace('tier', '')}</div>
              </div>
            ) : (
              <form onSubmit={handleTier2} className="flex flex-col gap-3">
                <p className="font-mono text-[12px] text-t-1 mb-2">
                  Complete KYC to enable fiat withdrawals and a programmatic bank account.
                </p>
                <div>
                  <label className="font-mono text-[10px] text-t-2 block mb-1 uppercase tracking-wider">Full Name</label>
                  <input value={fullName} onChange={e => setFullName(e.target.value)} required
                    className="w-full bg-bg-2 border border-border text-t-0 font-mono text-sm px-3 py-2 focus:border-accent focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono text-[10px] text-t-2 block mb-1 uppercase tracking-wider">Country Code</label>
                    <input value={country} onChange={e => setCountry(e.target.value)} placeholder="US" maxLength={3} required
                      className="w-full bg-bg-2 border border-border text-t-0 font-mono text-sm px-3 py-2 focus:border-accent focus:outline-none" />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] text-t-2 block mb-1 uppercase tracking-wider">Date of Birth</label>
                    <input type="date" value={dob} onChange={e => setDob(e.target.value)} required
                      className="w-full bg-bg-2 border border-border text-t-0 font-mono text-sm px-3 py-2 focus:border-accent focus:outline-none" />
                  </div>
                </div>
                <button type="submit" disabled={submitting}
                  className="bg-accent text-bg-0 font-mono text-xs font-medium px-5 py-2 hover:bg-accent-2 transition-colors disabled:opacity-50 w-fit">
                  {submitting ? 'verifying...' : 'verify identity'}
                </button>
              </form>
            )}
          </div>

          {/* Bank Account */}
          <div className="bg-bg-1 border border-border p-6">
            <div className="font-mono text-[10px] text-t-2 tracking-[0.1em] uppercase mb-4">Bank Account</div>

            {bank ? (
              <div className="bg-bg-2 border border-border p-4">
                <div className="grid grid-cols-2 gap-3 font-mono text-[12px]">
                  <div>
                    <div className="text-t-2 text-[10px]">ACCOUNT</div>
                    <div className="text-t-0">{bank.accountNumberMasked}</div>
                  </div>
                  <div>
                    <div className="text-t-2 text-[10px]">ROUTING</div>
                    <div className="text-t-0">{bank.routingNumber}</div>
                  </div>
                  <div>
                    <div className="text-t-2 text-[10px]">BANK</div>
                    <div className="text-t-0">{bank.bankName}</div>
                  </div>
                  <div>
                    <div className="text-t-2 text-[10px]">STATUS</div>
                    <div className="text-accent">{bank.status}</div>
                  </div>
                </div>
              </div>
            ) : isVerified ? (
              <div>
                <p className="font-mono text-[12px] text-t-1 mb-3">
                  Your identity is verified. Create a programmatic bank account to receive USD payouts.
                </p>
                <button onClick={handleCreateBank} disabled={submitting}
                  className="bg-accent text-bg-0 font-mono text-xs font-medium px-5 py-2 hover:bg-accent-2 transition-colors disabled:opacity-50">
                  {submitting ? 'creating...' : 'create bank account'}
                </button>
              </div>
            ) : (
              <p className="font-mono text-[12px] text-t-2">
                Complete KYC verification first to create a bank account.
              </p>
            )}
          </div>

          {message && (
            <div className={`font-mono text-[12px] p-3 border ${
              message.includes('verified') || message.includes('created') ? 'text-accent border-accent/25 bg-accent/5' : 'text-red border-red/25 bg-red/5'
            }`}>{message}</div>
          )}
        </div>
      )}
    </div>
  );
}
