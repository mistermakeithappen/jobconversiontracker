'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Check if this is a password reset redirect from Supabase
    const code = searchParams.get('code');
    const type = searchParams.get('type');
    
    if (code && (type === 'recovery' || !type)) {
      // This is a password reset link - redirect to reset password page with the code
      const resetUrl = new URL('/reset-password', window.location.origin);
      resetUrl.searchParams.set('code', code);
      if (type) resetUrl.searchParams.set('type', type);
      
      router.replace(resetUrl.toString());
      return;
    }
  }, [searchParams, router]);
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