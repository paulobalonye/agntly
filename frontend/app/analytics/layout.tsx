import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/shared/Footer';
import { GridBackground } from '@/components/shared/GridBackground';

export const metadata = {
  title: 'Network Analytics — Agntly',
  description: 'Real-time platform-wide statistics for the Agntly agent marketplace.',
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GridBackground />
      <LandingNav />
      {children}
      <Footer />
    </>
  );
}
