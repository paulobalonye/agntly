'use client';

import { useState } from 'react';

export default function ActivatePage() {
  const [purchaseCode, setPurchaseCode] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [licenseInfo, setLicenseInfo] = useState<{ domain: string; licenseType: string } | null>(null);

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    if (!purchaseCode.trim()) {
      setMessage('Please enter your purchase code.');
      setState('error');
      return;
    }

    setState('loading');
    setMessage('');

    try {
      const res = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseCode: purchaseCode.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        setState('success');
        setLicenseInfo(data.data);
        setMessage('License activated successfully! Redirecting...');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        setState('error');
        setMessage(data.error ?? 'Activation failed. Please check your purchase code.');
      }
    } catch {
      setState('error');
      setMessage('Network error. Please try again.');
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-bg-0">
      <div className="mb-8 text-center">
        <div className="font-mono text-sm font-medium text-accent flex items-center gap-2 justify-center">
          <span className="w-2 h-2 bg-accent rounded-full animate-pulse-dot" />
          AGNTLY.IO
        </div>
      </div>

      <div className="bg-bg-1 border border-border p-10 w-full max-w-md">
        <h1 className="font-display text-2xl font-semibold text-t-0 mb-2">Activate License</h1>
        <p className="text-sm text-t-1 mb-6">
          Enter your Envato/CodeCanyon purchase code to activate this installation.
        </p>

        <form onSubmit={handleActivate} className="flex flex-col gap-4">
          <div>
            <label className="font-mono text-[10px] text-t-2 block mb-1 tracking-[0.08em] uppercase">
              Purchase Code
            </label>
            <input
              type="text"
              value={purchaseCode}
              onChange={(e) => setPurchaseCode(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full bg-bg-2 border border-border text-t-0 font-mono text-sm px-3 py-3 focus:border-accent focus:outline-none placeholder-t-3"
              disabled={state === 'loading' || state === 'success'}
            />
          </div>

          {message && (
            <div className={`font-mono text-[12px] p-3 border ${
              state === 'success'
                ? 'text-accent bg-accent/5 border-accent/25'
                : 'text-red bg-red/5 border-red/25'
            }`}>
              {message}
            </div>
          )}

          {licenseInfo && (
            <div className="bg-bg-2 border border-border p-3">
              <div className="font-mono text-[10px] text-t-2 mb-1">ACTIVATED FOR</div>
              <div className="font-mono text-[13px] text-accent">{licenseInfo.domain}</div>
              <div className="font-mono text-[10px] text-t-2 mt-1">
                License: {licenseInfo.licenseType}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={state === 'loading' || state === 'success'}
            className="bg-accent text-bg-0 font-mono text-xs font-medium px-4 py-3 hover:bg-accent-2 transition-colors disabled:opacity-50 w-full"
          >
            {state === 'loading' ? 'verifying...' : state === 'success' ? 'activated!' : 'activate license'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-border">
          <p className="font-mono text-[10px] text-t-2 leading-relaxed">
            Find your purchase code in your Envato account under Downloads.
            Each license is valid for one domain only.
            <br /><br />
            Need help? Contact support at support@agntly.io
          </p>
        </div>
      </div>
    </div>
  );
}
