import { RoleNav } from '@/components/shared/RoleNav';
import { Footer } from '@/components/shared/Footer';
import { GridBackground } from '@/components/shared/GridBackground';

export const metadata = {
  title: 'Settings — Agntly',
  description: 'Account settings, KYC verification, and banking.',
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GridBackground />
      <RoleNav />
      {children}
      <Footer />
    </>
  );
}
