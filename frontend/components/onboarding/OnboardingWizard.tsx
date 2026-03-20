'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { RoleStep } from './RoleStep';
import { FrameworkStep } from './FrameworkStep';
import { WalletStep } from './WalletStep';

const STEPS = [
  {
    label: 'step 1 of 3 — choose your role',
    title: 'What are you\nhere to do?',
    desc: 'This helps us show you the right setup and code snippets. You can always change later.',
  },
  {
    label: 'step 2 of 3 — your framework',
    title: 'What are you\nbuilding with?',
    desc: "We'll generate the exact integration code for your setup.",
  },
  {
    label: 'step 3 of 3 — connect wallet',
    title: 'Set up your\nagent wallet',
    desc: 'Every agent needs a wallet to receive payments. We create one automatically — or connect your own.',
  },
] as const;

export function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetRole = searchParams.get('role');
  const [step, setStep] = useState(presetRole === 'builder' ? 1 : 0);
  const [role, setRole] = useState(presetRole === 'builder' ? 'builder' : 'builder');
  const [framework, setFramework] = useState('python');

  const currentStep = STEPS[step];

  function handleBack() {
    if (step === 0) {
      router.push('/');
    } else {
      setStep((s) => s - 1);
    }
  }

  function handleNext() {
    if (step < 2) {
      setStep((s) => s + 1);
    } else {
      document.cookie = `agntly_role=${role}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      const destination = role === 'builder' ? '/dashboard' : '/marketplace';
      router.push(destination);
    }
  }

  return (
    <div className="w-full max-w-[560px] flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="font-mono text-sm font-medium text-accent flex items-center gap-2 tracking-tight">
          <span className="w-2 h-2 bg-accent rounded-full animate-pulse-dot" />
          AGNTLY.IO
        </div>
        <Link
          href="/marketplace"
          className="font-mono text-[11px] text-t-2 hover:text-t-1 transition-colors"
        >
          skip to marketplace →
        </Link>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={[
              'h-[3px] flex-1 transition-colors',
              i <= step ? 'bg-accent' : 'bg-border',
            ].join(' ')}
          />
        ))}
      </div>

      {/* Step label */}
      <div className="font-mono text-[10px] text-accent tracking-[0.12em] uppercase">
        {currentStep.label}
      </div>

      {/* Title + description */}
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-[30px] font-semibold text-t-0 leading-tight whitespace-pre-line">
          {currentStep.title}
        </h2>
        <p className="font-sans text-sm text-t-1 leading-relaxed">{currentStep.desc}</p>
      </div>

      {/* Step content */}
      <div>
        {step === 0 && <RoleStep selected={role} onSelect={setRole} />}
        {step === 1 && <FrameworkStep selected={framework} onSelect={setFramework} />}
        {step === 2 && <WalletStep onComplete={handleNext} />}
      </div>

      {/* Actions */}
      <div className="flex justify-between gap-3 pt-2">
        <button
          onClick={handleBack}
          className="bg-transparent border border-border text-t-2 font-mono text-xs px-5 py-2.5 hover:border-border-2 hover:text-t-1 transition-all"
        >
          ← back
        </button>
        <button
          onClick={handleNext}
          className="bg-accent text-bg-0 font-mono text-xs font-medium px-5 py-2.5 hover:bg-accent-2 transition-colors"
        >
          {step === 2 ? 'enter registry →' : 'next →'}
        </button>
      </div>
    </div>
  );
}
