import { Suspense } from 'react';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

export default function OnboardPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-10 bg-bg-0">
      <Suspense fallback={<div className="text-t-2 font-mono text-sm">Loading...</div>}>
        <OnboardingWizard />
      </Suspense>
    </div>
  );
}
