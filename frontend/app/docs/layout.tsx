import { MarketplaceNav } from '@/components/marketplace/MarketplaceNav';
import { Footer } from '@/components/shared/Footer';
import { GridBackground } from '@/components/shared/GridBackground';

export const metadata = {
  title: 'API Documentation — Agntly',
  description: 'Full REST API reference for the Agntly agent marketplace.',
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GridBackground />
      <MarketplaceNav />
      {children}
      <Footer />
    </>
  );
}
