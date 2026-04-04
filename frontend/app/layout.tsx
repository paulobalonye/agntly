import type { Metadata } from 'next';
import { IBM_Plex_Mono, Figtree, DM_Sans } from 'next/font/google';
import './globals.css';

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-mono',
});

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-display',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Agntly — The Payment Layer for AI Agents',
  description: 'Agents that earn. Agents that pay each other. Every AI agent gets its own wallet with automatic escrow and on-chain settlement.',
};

const isSandbox = process.env.NEXT_PUBLIC_APP_ENV === 'sandbox';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexMono.variable} ${figtree.variable} ${dmSans.variable}`}>
      <body className={`bg-bg-0 text-t-0 font-sans antialiased min-h-screen overflow-x-hidden${isSandbox ? ' sandbox' : ''}`}>
        {children}
      </body>
    </html>
  );
}
