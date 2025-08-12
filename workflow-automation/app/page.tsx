'use client';

import HeroSection from '@/components/landing/HeroSection';
import ZeroTrainingSection from '@/components/landing/ZeroTrainingSection';
import AIAdministratorSection from '@/components/landing/AIAdministratorSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import ForGHLUsersSection from '@/components/landing/ForGHLUsersSection';
import ForBusinessesSection from '@/components/landing/ForBusinessesSection';
import ROISection from '@/components/landing/ROISection';
import CTASection from '@/components/landing/CTASection';
import NavigationBar from '@/components/landing/NavigationBar';

export default function HomePage() {
  return (
    <main className="overflow-x-hidden">
      <NavigationBar />
      <HeroSection />
      <ZeroTrainingSection />
      <AIAdministratorSection />
      <HowItWorksSection />
      <ForGHLUsersSection />
      <ForBusinessesSection />
      <ROISection />
      <CTASection />
    </main>
  );
}