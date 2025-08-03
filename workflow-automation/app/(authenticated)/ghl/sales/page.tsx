'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { 
  DollarSign, 
  TrendingUp, 
  Package, 
  Users,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

export default function SalesDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalInvoices: 0,
    paidInvoices: 0,
    pendingAmount: 0,
    monthlyGrowth: 0,
    activeProducts: 0,
    topProducts: [] as any[]
  });

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch invoice data from commission_events
      const invoicesRes = await fetch('/api/sales/invoices', {
        credentials: 'include'
      });

      if (invoicesRes.ok) {
        const data = await invoicesRes.json();
        const { invoices, stats } = data;

        // Calculate monthly revenue
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        const thisMonthRevenue = invoices
          .filter((i: any) => new Date(i.invoice_date) >= startOfMonth && i.status === 'paid')
          .reduce((sum: number, i: any) => sum + i.amount_paid, 0);

        const lastMonthRevenue = invoices
          .filter((i: any) => {
            const date = new Date(i.invoice_date);
            return date >= startOfLastMonth && date < startOfMonth && i.status === 'paid';
          })
          .reduce((sum: number, i: any) => sum + i.amount_paid, 0);

        const growth = lastMonthRevenue > 0 
          ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
          : 0;

        setMetrics({
          totalRevenue: stats.totalPaid || 0,
          monthlyRevenue: thisMonthRevenue,
          totalInvoices: stats.totalInvoices || 0,
          paidInvoices: stats.byStatus?.paid || 0,
          pendingAmount: stats.totalDue || 0,
          monthlyGrowth: growth,
          activeProducts: 0, // Will be populated if we add product fetching
          topProducts: []
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading sales data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Sales Dashboard</h1>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.totalRevenue)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.monthlyRevenue)}</p>
              <div className="flex items-center mt-1">
                {metrics.monthlyGrowth >= 0 ? (
                  <ArrowUpRight className="w-4 h-4 text-green-500 mr-1" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-red-500 mr-1" />
                )}
                <span className={`text-sm ${metrics.monthlyGrowth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPercentage(metrics.monthlyGrowth)}
                </span>
              </div>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Paid Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.paidInvoices}</p>
              <p className="text-sm text-gray-500">of {metrics.totalInvoices} total</p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-full">
              <Package className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Amount</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.pendingAmount)}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <Users className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Chart Placeholder */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Overview</h2>
        <div className="h-64 flex items-center justify-center text-gray-400">
          <p>Revenue chart will be displayed here</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a
          href="/ghl/sales/invoices"
          className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
        >
          <h3 className="font-semibold text-gray-900 mb-2">View Invoices</h3>
          <p className="text-sm text-gray-600">Manage and track all invoices</p>
        </a>
        
        <a
          href="/ghl/sales/estimates"
          className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
        >
          <h3 className="font-semibold text-gray-900 mb-2">View Estimates</h3>
          <p className="text-sm text-gray-600">Track estimates and conversions</p>
        </a>
        
        <a
          href="/ghl/sales/products"
          className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
        >
          <h3 className="font-semibold text-gray-900 mb-2">Manage Products</h3>
          <p className="text-sm text-gray-600">View and sync products from GoHighLevel</p>
        </a>
      </div>
    </div>
  );
}