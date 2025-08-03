'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Package, Calculator, DollarSign, FileText, ClipboardList } from 'lucide-react';

export default function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/ghl/sales',
      label: 'Dashboard',
      icon: BarChart3,
    },
    {
      href: '/ghl/sales/products',
      label: 'Products',
      icon: Package,
    },
    {
      href: '/ghl/sales/estimates',
      label: 'Estimates',
      icon: ClipboardList,
    },
    {
      href: '/ghl/sales/invoices',
      label: 'Invoices',
      icon: FileText,
    },
    {
      href: '/ghl/sales/commissions',
      label: 'Commissions',
      icon: Calculator,
    },
    {
      href: '/ghl/sales/payouts',
      label: 'Payouts',
      icon: DollarSign,
    },
  ];

  const isActive = (href: string) => {
    if (href === '/ghl/sales') {
      return pathname === '/ghl/sales';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sub-navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-2 py-4 px-1 border-b-2 text-sm font-medium transition-colors
                    ${active
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
    </div>
  );
}