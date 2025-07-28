'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Zap, List } from 'lucide-react';

const workflowNavItems = [
  { href: '/workflows', label: 'Workflows', icon: Zap },
  { href: '/workflows/executions', label: 'Executions', icon: List },
];

export default function WorkflowsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Don't show navigation for specific workflow pages or new workflow creation
  const showNavigation = !pathname.includes('/workflows/new') && 
                         !pathname.match(/^\/workflows\/[^\/]+$/) &&
                         !pathname.includes('/workflows/executions/');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {showNavigation && (
        <div className="py-6 border-b border-gray-200 mb-8">
          <nav className="flex space-x-8">
            {workflowNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === '/workflows' 
                ? pathname === '/workflows' || pathname === '/workflows/executions'
                : pathname.startsWith(item.href);
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
      
      {children}
    </div>
  );
}