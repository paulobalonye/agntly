import { GridBackground } from '@/components/shared/GridBackground';
import { Footer } from '@/components/shared/Footer';
import { LandingNav } from '@/components/landing/LandingNav';
import { HeroSection } from '@/components/landing/HeroSection';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { RolesSection } from '@/components/landing/RolesSection';
import { AutonomousSection } from '@/components/landing/AutonomousSection';
import { LiveTicker } from '@/components/landing/LiveTicker';
import { CTASection } from '@/components/landing/CTASection';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen overflow-hidden relative">
      <GridBackground />

      {/* Glow orbs */}
      <div className="absolute w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-accent rounded-full blur-[120px] opacity-[0.18] -top-[100px] md:-top-[200px] -left-[50px] md:-left-[100px] pointer-events-none animate-drift-1" />
      <div className="absolute w-[200px] md:w-[400px] h-[200px] md:h-[400px] bg-blue rounded-full blur-[120px] opacity-[0.18] -bottom-[50px] md:-bottom-[100px] -right-[50px] md:-right-[100px] pointer-events-none animate-drift-2" />

      <LandingNav />
      <HeroSection />
      <AutonomousSection />
      <HowItWorks />
      <RolesSection />
      <LiveTicker />
      <CTASection />
      <Footer />
    </div>
  );
}
