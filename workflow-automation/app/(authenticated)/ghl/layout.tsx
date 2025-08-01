'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { 
  Building2, 
  Users, 
  DollarSign, 
  Receipt, 
  Settings, 
  BarChart3 
} from 'lucide-react';

const ghlNavItems = [
  { 
    href: '/ghl', 
    label: 'Overview', 
    icon: Building2,
    description: 'GoHighLevel integration status and overview'
  },
  { 
    href: '/ghl/contacts', 
    label: 'Contacts', 
    icon: Users,
    description: 'Contact synchronization and management'
  },
  { 
    href: '/ghl/opportunities', 
    label: 'Opportunities', 
    icon: DollarSign,
    description: 'Pipeline view and profitability tracking'
  },
  { 
    href: '/ghl/receipts', 
    label: 'Receipt Processing', 
    icon: Receipt,
    description: 'AI-powered receipt processing and SMS automation'
  },
  { 
    href: '/ghl/settings', 
    label: 'Settings', 
    icon: Settings,
    description: 'Admin settings, payment structures, and credit cards'
  },
];

export default function GHLLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">GoHighLevel</h1>
            <p className="text-gray-600">Manage your GoHighLevel integration and automation</p>
          </div>
        </div>

        {/* Sub-navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {ghlNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              const isInSection = pathname.startsWith(item.href + '/');
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors",
                    isActive || isInSection
                      ? "border-orange-500 text-orange-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  )}
                  title={item.description}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}