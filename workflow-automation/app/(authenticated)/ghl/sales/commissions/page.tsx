'use client';

import Link from 'next/link';
import { 
  Settings, Package, TrendingUp, Shield, 
  Calculator, FileText, AlertCircle 
} from 'lucide-react';

const commissionPages = [
  {
    href: '/ghl/sales/commissions/products',
    title: 'Product Commission Rules',
    description: 'Configure commission rates and rules for each product',
    icon: Package,
    color: 'bg-purple-100 text-purple-600'
  },
  {
    href: '/ghl/sales/analytics',
    title: 'Product Analytics',
    description: 'View product performance and sales velocity metrics',
    icon: TrendingUp,
    color: 'bg-blue-100 text-blue-600'
  },
  {
    href: '/ghl/sales/leaderboard',
    title: 'Sales Leaderboard',
    description: 'Track top performers and active challenges',
    icon: Calculator,
    color: 'bg-green-100 text-green-600'
  },
  {
    href: '/ghl/settings/payment-structure',
    title: 'Payment Structures',
    description: 'Manage team member commission rates and structures',
    icon: FileText,
    color: 'bg-orange-100 text-orange-600'
  }
];

export default function CommissionsOverview() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Commission Settings</h1>
        <p className="text-gray-600">Configure commission rules, structures, and validation</p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-2">Product-Based Commission System</p>
            <p>
              Our commission system now supports product-specific rules including:
            </p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Different rates for initial sales vs renewals</li>
              <li>Monthly recurring revenue (MRR) tracking</li>
              <li>Clawback rules for cancelled subscriptions</li>
              <li>Margin-based validation to ensure profitability</li>
              <li>Manager approval workflows for high-value commissions</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {commissionPages.map((page) => {
          const Icon = page.icon;
          return (
            <Link
              key={page.href}
              href={page.href}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${page.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{page.title}</h3>
                  <p className="text-sm text-gray-600">{page.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Commission Validation Features */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Smart Commission Validation</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Automatic Checks</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Margin validation to ensure commissions don't exceed product profitability</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Duplicate commission detection</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Minimum sale amount verification</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Product availability at time of sale</span>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Approval Workflows</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">⚡</span>
                <span>Manager approval for commissions exceeding thresholds</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">⚡</span>
                <span>Override capability with audit trail</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">⚡</span>
                <span>Suggested actions for validation warnings</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">⚡</span>
                <span>Complete validation audit history</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Rules</p>
              <p className="text-2xl font-bold text-gray-900">-</p>
            </div>
            <Settings className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Approvals</p>
              <p className="text-2xl font-bold text-gray-900">-</p>
            </div>
            <Shield className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Validation Rate</p>
              <p className="text-2xl font-bold text-gray-900">-</p>
            </div>
            <AlertCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>
    </div>
  );
}