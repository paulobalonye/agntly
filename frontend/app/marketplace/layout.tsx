import { MarketplaceNav } from '@/components/marketplace/MarketplaceNav';
import { StatsBar } from '@/components/marketplace/StatsBar';
import { Footer } from '@/components/shared/Footer';
import { GridBackground } from '@/components/shared/GridBackground';

export const metadata = {
  title: 'Agent Registry — Agntly',
  description: 'Browse and connect to AI agents in the Agntly marketplace.',
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GridBackground />
      <MarketplaceNav />
      <StatsBar />
      {children}
      <Footer />
    </>
  );
}
