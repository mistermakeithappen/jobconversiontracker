'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  Package, TrendingUp, Users, DollarSign, Award, Clock, 
  Filter, Download, RefreshCw, ChevronDown 
} from 'lucide-react';

interface ProductAnalytics {
  summary: {
    totalRevenue: number;
    totalUnits: number;
    totalCommissions: number;
    uniqueProducts: number;
    topProduct: any;
    topSalesPerson: any;
    averageCommissionRate: number;
  };
  products: Array<{
    productId: string;
    product: any;
    unitsSold: number;
    totalRevenue: number;
    averageSalePrice: number;
    uniqueCustomers: number;
    commissionsPaid: number;
    commissionRate: number;
    topSalesPeople: any[];
    salesVelocity: number;
  }>;
  salesPeople?: Array<{
    memberId: string;
    member: any;
    totalRevenue: number;
    totalUnits: number;
    commissionEarned: number;
    commissionRate: number;
    productBreakdown: any[];
    uniqueProducts: number;
    averageOrderValue: number;
  }>;
  timeSeries: Array<{
    date: string;
    revenue: number;
    units: number;
    transactions: number;
  }>;
}

const COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899'];

export default function ProductAnalyticsDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<ProductAnalytics | null>(null);
  const [dateRange, setDateRange] = useState('30days');
  const [groupBy, setGroupBy] = useState<'product' | 'salesperson'>('product');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, groupBy, selectedProduct]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dateRange,
        groupBy,
        ...(selectedProduct && { productId: selectedProduct })
      });

      const response = await fetch(`/api/analytics/products?${params}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
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

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const exportData = () => {
    if (!analytics) return;

    const csvContent = [
      ['Product Analytics Report', `Date Range: ${dateRange}`],
      [],
      ['Summary'],
      ['Total Revenue', analytics.summary.totalRevenue],
      ['Total Units', analytics.summary.totalUnits],
      ['Total Commissions', analytics.summary.totalCommissions],
      ['Average Commission Rate', analytics.summary.averageCommissionRate],
      [],
      ['Product Details'],
      ['Product', 'Units Sold', 'Revenue', 'Avg Price', 'Commission Rate', 'Sales Velocity'],
      ...analytics.products.map(p => [
        p.product?.name || 'Unknown',
        p.unitsSold,
        p.totalRevenue,
        p.averageSalePrice,
        p.commissionRate,
        p.salesVelocity
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Performance Analytics</h1>
          <p className="text-gray-600">Track product sales, velocity, and commission metrics</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="year">Last Year</option>
          </select>
          <button
            onClick={fetchAnalytics}
            className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={exportData}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(analytics.summary.totalRevenue)}
              </p>
            </div>
            <DollarSign className="w-10 h-10 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Units Sold</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.summary.totalUnits.toLocaleString()}
              </p>
            </div>
            <Package className="w-10 h-10 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg Commission Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatPercent(analytics.summary.averageCommissionRate)}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-purple-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Products</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.summary.uniqueProducts}
              </p>
            </div>
            <Award className="w-10 h-10 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Revenue Trend Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analytics.timeSeries}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value: any) => formatCurrency(value)} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="#8B5CF6" 
              strokeWidth={2}
              name="Revenue"
            />
            <Line 
              type="monotone" 
              dataKey="units" 
              stroke="#10B981" 
              strokeWidth={2}
              name="Units"
              yAxisId="right"
            />
            <YAxis yAxisId="right" orientation="right" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Products by Revenue</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.products.slice(0, 5)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="product.name" 
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis />
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
              <Bar dataKey="totalRevenue" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Velocity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.products.slice(0, 5)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="product.name" 
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis />
              <Tooltip formatter={(value: any) => `${value.toFixed(2)} units/day`} />
              <Bar dataKey="salesVelocity" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Product Performance Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Product Performance Details</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGroupBy('product')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  groupBy === 'product' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                By Product
              </button>
              <button
                onClick={() => setGroupBy('salesperson')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  groupBy === 'salesperson' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                By Salesperson
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {groupBy === 'product' ? 'Product' : 'Sales Person'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Units Sold
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {groupBy === 'product' ? 'Avg Price' : 'Avg Order'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commission Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {groupBy === 'product' ? 'Velocity' : 'Products'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Top Performer
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {groupBy === 'product' ? (
                analytics.products.map((product) => (
                  <tr key={product.productId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="w-5 h-5 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {product.product?.name || 'Unknown Product'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {product.uniqueCustomers} customers
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.unitsSold.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(product.totalRevenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(product.averageSalePrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {formatPercent(product.commissionRate)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.salesVelocity.toFixed(2)}/day
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.topSalesPeople[0] ? (
                        <div>
                          <div className="font-medium">
                            {product.topSalesPeople[0].member?.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatCurrency(product.topSalesPeople[0].revenue)}
                          </div>
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                analytics.salesPeople?.map((person) => (
                  <tr key={person.memberId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Users className="w-5 h-5 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {person.member?.name || 'Unknown'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {person.member?.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {person.totalUnits.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(person.totalRevenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(person.averageOrderValue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {formatPercent(person.commissionRate)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {person.uniqueProducts} products
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {person.productBreakdown[0] ? (
                        <div>
                          <div className="font-medium">
                            {person.productBreakdown[0].product?.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatCurrency(person.productBreakdown[0].revenue)}
                          </div>
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}