import { MarketplaceNav } from '@/components/marketplace/MarketplaceNav';
import { Footer } from '@/components/shared/Footer';
import { GridBackground } from '@/components/shared/GridBackground';

export const metadata = {
  title: 'Wallet — Agntly',
  description: 'Manage your USDC balance, fund your wallet, and withdraw funds.',
};

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GridBackground />
      <MarketplaceNav />
      {children}
      <Footer />
    </>
  );
}
