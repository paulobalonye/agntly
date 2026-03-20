import { RoleNav } from '@/components/shared/RoleNav';
import { Footer } from '@/components/shared/Footer';
import { GridBackground } from '@/components/shared/GridBackground';

export const metadata = {
  title: 'My Agents — Agntly',
  description: 'Manage and register your AI agents on the Agntly marketplace.',
};

export default function MyAgentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GridBackground />
      <RoleNav />
      {children}
      <Footer />
    </>
  );
}
