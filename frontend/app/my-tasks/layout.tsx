import { RoleNav } from '@/components/shared/RoleNav';
import { Footer } from '@/components/shared/Footer';
import { GridBackground } from '@/components/shared/GridBackground';

export const metadata = {
  title: 'My Tasks — Agntly',
  description: 'View your task history, spending, and connected agents.',
};

export default function MyTasksLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GridBackground />
      <RoleNav />
      {children}
      <Footer />
    </>
  );
}
