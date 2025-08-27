'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { Save, FileText, CreditCard } from 'lucide-react';

interface InvoiceSettings {
  default_payment_terms: string;
  default_notes: string;
  default_tax_rate: number;
  default_due_days: number;
}

export default function InvoiceSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<InvoiceSettings>({
    default_payment_terms: 'Net 30',
    default_notes: 'Thank you for your business. Payment is due within 30 days.',
    default_tax_rate: 8.25,
    default_due_days: 30
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/organization', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const invoiceSettings = data.organization?.invoice_settings;
        
        if (invoiceSettings) {
          setSettings({
            default_payment_terms: invoiceSettings.default_payment_terms || 'Net 30',
            default_notes: invoiceSettings.default_notes || 'Thank you for your business. Payment is due within 30 days.',
            default_tax_rate: invoiceSettings.default_tax_rate || 8.25,
            default_due_days: invoiceSettings.default_due_days || 30
          });
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/organization', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          invoice_settings: settings
        })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Invoice settings saved successfully!' });
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof InvoiceSettings, value: string | number) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <CreditCard className="w-6 h-6 text-blue-600 mr-3" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invoice Settings</h1>
              <p className="text-sm text-gray-600">Configure default settings for new invoices</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          {message && (
            <div className={`mb-6 p-4 rounded-md ${
              message.type === 'success' 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message.text}
            </div>
          )}

          <div className="space-y-6">
            {/* Payment Terms */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Payment Terms
              </label>
              <select
                value={settings.default_payment_terms}
                onChange={(e) => handleInputChange('default_payment_terms', e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Due on receipt">Due on receipt</option>
                <option value="Net 15">Net 15</option>
                <option value="Net 30">Net 30</option>
                <option value="Net 60">Net 60</option>
                <option value="Net 90">Net 90</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Default payment terms that will appear on new invoices
              </p>
            </div>

            {/* Due Days */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Due Days
              </label>
              <input
                type="number"
                min="0"
                max="365"
                value={settings.default_due_days}
                onChange={(e) => handleInputChange('default_due_days', parseInt(e.target.value) || 30)}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Number of days from invoice creation date to set as due date
              </p>
            </div>

            {/* Tax Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Tax Rate (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={settings.default_tax_rate}
                onChange={(e) => handleInputChange('default_tax_rate', parseFloat(e.target.value) || 0)}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Default tax rate to apply to new invoices (can be overridden per invoice)
              </p>
            </div>

            {/* Default Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Invoice Notes
              </label>
              <textarea
                value={settings.default_notes}
                onChange={(e) => handleInputChange('default_notes', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Thank you for your business. Payment is due within 30 days."
              />
              <p className="text-sm text-gray-500 mt-1">
                Default notes that will appear on new invoices (payment instructions, etc.)
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
