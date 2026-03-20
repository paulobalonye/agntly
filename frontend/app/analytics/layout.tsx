import { RoleNav } from '@/components/shared/RoleNav';
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
      <RoleNav />
      {children}
      <Footer />
    </>
  );
}
