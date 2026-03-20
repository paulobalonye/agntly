import { AdminNav } from '@/components/admin/AdminNav';
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
      <AdminNav />
      {children}
      <Footer />
    </>
  );
}
