'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  User, 
  Code, 
  Key, 
  CreditCard, 
  Bell, 
  Shield, 
  HelpCircle,
  Settings as SettingsIcon,
  ChevronRight
} from 'lucide-react';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general');

  const settingSections = [
    {
      id: 'general',
      title: 'General',
      description: 'Account and profile settings',
      icon: User,
      href: '/settings/general'
    },
    {
      id: 'api-keys',
      title: 'API Keys',
      description: 'Manage integration API keys',
      icon: Key,
      href: '/integrations'
    },
    {
      id: 'billing',
      title: 'Billing & Credits',
      description: 'Manage your subscription and credits',
      icon: CreditCard,
      href: '/settings/billing'
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Configure alerts and notifications',
      icon: Bell,
      href: '/settings/notifications'
    },
    {
      id: 'security',
      title: 'Security',
      description: 'Security settings and authentication',
      icon: Shield,
      href: '/settings/security'
    },
    {
      id: 'developer',
      title: 'Developer',
      description: 'API documentation and developer tools',
      icon: Code,
      href: '/developer'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">
          Manage your account preferences and integrations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.id}
              href={section.href}
              className="group bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors">
                {section.title}
              </h3>
              <p className="text-gray-600 text-sm">
                {section.description}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="mt-12 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Account Overview</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CreditCard className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">15,000</p>
            <p className="text-sm text-gray-500">Credits Remaining</p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <SettingsIcon className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">6</p>
            <p className="text-sm text-gray-500">Active Integrations</p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Code className="w-8 h-8 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">23</p>
            <p className="text-sm text-gray-500">API Endpoints</p>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start space-x-3">
          <HelpCircle className="w-6 h-6 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Need Help?</h3>
            <p className="text-blue-700 text-sm mb-4">
              Check out our documentation or contact support if you have any questions about managing your account.
            </p>
            <div className="flex space-x-3">
              <Link
                href="/developer"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Code className="w-4 h-4" />
                <span>View Documentation</span>
              </Link>
              <button className="px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}