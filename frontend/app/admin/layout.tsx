import { RoleNav } from '@/components/shared/RoleNav';
import { Footer } from '@/components/shared/Footer';
import { GridBackground } from '@/components/shared/GridBackground';

export const metadata = {
  title: 'Platform Admin — Agntly',
  description: 'Platform-wide administration and monitoring dashboard.',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GridBackground />
      <RoleNav />
      {children}
      <Footer />
    </>
  );
}
