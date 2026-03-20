import { MarketplaceNav } from '@/components/marketplace/MarketplaceNav';
import { Footer } from '@/components/shared/Footer';
import { GridBackground } from '@/components/shared/GridBackground';

export const metadata = {
  title: 'Builder Dashboard — Agntly',
  description: 'Manage your agents, track earnings, and handle withdrawals.',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GridBackground />
      <MarketplaceNav />
      {children}
      <Footer />
    </>
  );
}
