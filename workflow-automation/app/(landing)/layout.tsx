import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Only CRM Your Team Already Knows How to Use | SMS-Powered Business Management',
  description: 'Zero training required. Your entire team can use it because it works through text messages. Track profit, manage operations, and scale your business - all through SMS.',
  keywords: 'CRM, SMS CRM, text message CRM, GoHighLevel alternative, profit tracking, business automation, zero training CRM',
  openGraph: {
    title: 'The Only CRM Your Team Already Knows How to Use',
    description: 'Because it works through text messages. Zero training. Zero resistance. 100% adoption from day one.',
    images: ['/og-image.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Only CRM Your Team Already Knows How to Use',
    description: 'Because it works through text messages. Zero training. Zero resistance. 100% adoption from day one.',
    images: ['/twitter-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  );
}