'use client';

import dynamic from 'next/dynamic';
import HeroSection from '@/components/landing/HeroSection';
import ZeroTrainingSection from '@/components/landing/ZeroTrainingSection';
import AIAdministratorSection from '@/components/landing/AIAdministratorSection';
import HowItWorksSection from '@/components/landing/HowItWorksSection';
import ForGHLUsersSection from '@/components/landing/ForGHLUsersSection';
import ForBusinessesSection from '@/components/landing/ForBusinessesSection';
import ROISection from '@/components/landing/ROISection';
import CTASection from '@/components/landing/CTASection';
import NavigationBar from '@/components/landing/NavigationBar';

// Dynamically import heavy components
const InteractiveSMSDemo = dynamic(() => import('@/components/landing/InteractiveSMSDemo'), {
  ssr: false,
  loading: () => <div className="h-96 bg-gray-100 animate-pulse rounded-lg" />
});

export default function LandingPage() {
  return (
    <main className="overflow-x-hidden">
      <NavigationBar />
      <HeroSection />
      <ZeroTrainingSection />
      <AIAdministratorSection />
      <HowItWorksSection />
      <ForGHLUsersSection />
      <ForBusinessesSection />
      <InteractiveSMSDemo />
      <CTASection />
    </main>
  );
}