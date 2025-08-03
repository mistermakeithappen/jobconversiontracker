'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { Package, RefreshCw, Search, Filter, DollarSign } from 'lucide-react';

interface Product {
  id: string;
  ghl_product_id: string;
  name: string;
  description: string | null;
  price: number | null;
  price_type: 'one_time' | 'recurring';
  recurring_interval: string | null;
  recurring_interval_count: number;
  currency: string;
  is_active: boolean;
  synced_at: string;
  metadata: any;
}

export default function ProductsManagement() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<string>('');
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'one_time' | 'recurring'>('all');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    if (user) {
      fetchIntegrations();
    }
  }, [user]);

  useEffect(() => {
    if (selectedIntegration) {
      fetchProducts();
    }
  }, [selectedIntegration]);

  const fetchIntegrations = async () => {
    try {
      const response = await fetch('/api/integrations/automake/status');
      if (response.ok) {
        const data = await response.json();
        if (data.connected && data.integrationId) {
          // We have a single active GHL integration
          setIntegrations([{
            id: data.integrationId,
            name: 'GoHighLevel',
            type: 'gohighlevel'
          }]);
          setSelectedIntegration(data.integrationId);
        } else {
          setIntegrations([]);
        }
      }
    } catch (error) {
      console.error('Error fetching integrations:', error);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/products/sync?integrationId=${selectedIntegration}`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncProducts = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId: selectedIntegration })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        fetchProducts();
      } else {
        const error = await response.json();
        if (error.requiresReauth) {
          if (confirm(error.error + '\n\nWould you like to reconnect now?')) {
            window.location.href = '/ghl/settings';
          }
        } else {
          alert(`Failed to sync products: ${error.error}`);
        }
      }
    } catch (error) {
      console.error('Error syncing products:', error);
      alert('Error syncing products');
    } finally {
      setSyncing(false);
    }
  };

  const formatPrice = (price: number | null, currency: string) => {
    if (price === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(price);
  };

  const formatPriceType = (product: Product) => {
    if (product.price_type === 'recurring' && product.recurring_interval) {
      const interval = product.recurring_interval_count > 1 
        ? `${product.recurring_interval_count} ${product.recurring_interval}s`
        : product.recurring_interval;
      return `Recurring (${interval})`;
    }
    return 'One-time';
  };

  const getLastSyncTime = () => {
    if (products.length === 0) return 'Never';
    const latestSync = products.reduce((latest, product) => {
      const syncTime = new Date(product.synced_at).getTime();
      return syncTime > latest ? syncTime : latest;
    }, 0);
    
    const date = new Date(latestSync);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  // Filter products based on search and filters
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = filterType === 'all' || 
                       (filterType === 'one_time' && product.price_type === 'one_time') ||
                       (filterType === 'recurring' && product.price_type === 'recurring');
    
    const matchesActive = filterActive === 'all' ||
                         (filterActive === 'active' && product.is_active) ||
                         (filterActive === 'inactive' && !product.is_active);
    
    return matchesSearch && matchesType && matchesActive;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products Management</h1>
          <p className="text-gray-600">Manage products synced from GoHighLevel</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedIntegration}
            onChange={(e) => setSelectedIntegration(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {integrations.map(integration => (
              <option key={integration.id} value={integration.id}>
                {integration.name}
              </option>
            ))}
          </select>
          <button
            onClick={syncProducts}
            disabled={syncing}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Products'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Total Products</p>
          <p className="text-2xl font-bold text-gray-900">{products.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Active Products</p>
          <p className="text-2xl font-bold text-gray-900">
            {products.filter(p => p.is_active).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Recurring Products</p>
          <p className="text-2xl font-bold text-gray-900">
            {products.filter(p => p.price_type === 'recurring').length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Last Sync</p>
          <p className="text-lg font-semibold text-gray-900">{getLastSyncTime()}</p>
        </div>
      </div>

      {/* Pricing Note */}
      <div className="bg-blue-50 border border-blue-400 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-800 mt-0.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div className="text-sm">
            <p className="font-bold mb-1 text-gray-900">About Product Pricing</p>
            <p className="text-gray-900">
              GoHighLevel stores prices separately from products. Our sync process attempts to fetch prices from multiple sources:
            </p>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-gray-900">
              <li>Product price endpoints (when available)</li>
              <li>Price mentioned in product names or descriptions (e.g., "$500")</li>
              <li>Known service patterns (e.g., "Service Minimum" = $200)</li>
            </ul>
            <p className="mt-1 text-gray-900">
              If no price is found, products will display "N/A". You can still use these products for commission tracking by setting product-specific commission rules.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Types</option>
              <option value="one_time">One-time</option>
              <option value="recurring">Recurring</option>
            </select>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-600">
            {products.length === 0 
              ? 'No products found. Click "Sync Products" to import from GoHighLevel.'
              : 'No products match your filters.'}
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Package className="w-8 h-8 text-purple-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                      <p className="text-sm text-gray-600 truncate">ID: {product.ghl_product_id}</p>
                    </div>
                  </div>
                  <span className={`ml-2 flex-shrink-0 px-2 py-1 text-xs font-medium rounded-full ${
                    product.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {product.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                {product.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {product.description
                      .replace(/<[^>]*>/g, '') // Remove HTML tags
                      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with spaces
                      .replace(/&quot;/g, '"') // Replace &quot; with quotes
                      .replace(/&[^;]+;/g, '') // Remove other HTML entities
                      .trim()
                    }
                  </p>
                )}
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Price</span>
                    <span className="font-semibold text-gray-900">
                      {formatPrice(product.price, product.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Type</span>
                    <span className="text-sm text-gray-900">
                      {formatPriceType(product)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Currency</span>
                    <span className="text-sm text-gray-900">{product.currency}</span>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-600">
                    Last synced: {new Date(product.synced_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}