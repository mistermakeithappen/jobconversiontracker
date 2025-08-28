'use client';

import { useState, useEffect } from 'react';
import { Save, Settings, FileText, Info } from 'lucide-react';

export default function EstimateSettings() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [organization, setOrganization] = useState<any>(null);
  
  // Settings state
  const [defaultTerms, setDefaultTerms] = useState('');
  const [defaultNotes, setDefaultNotes] = useState('');
  const [defaultValidityPeriod, setDefaultValidityPeriod] = useState(30);
  const [requireSignature, setRequireSignature] = useState(false);
  const [includeCompanyLogo, setIncludeCompanyLogo] = useState(true);
  const [autoCalculateTax, setAutoCalculateTax] = useState(true);
  const [defaultTaxRate, setDefaultTaxRate] = useState(8.25);

  // Predefined contract templates
  const contractTemplates = [
    {
      id: 'construction',
      name: 'Construction Services',
      terms: `TERMS AND CONDITIONS

1. PAYMENT TERMS
   - 50% deposit required upon acceptance of this estimate
   - Balance due upon completion of work
   - Payment terms: Net 30 days from invoice date
   - Late payments subject to 1.5% monthly service charge

2. PROJECT TIMELINE
   - Work will commence within 7-10 business days of deposit receipt
   - Timeline estimates are approximate and may vary due to weather, material availability, or change orders
   - Client will be notified of any significant delays

3. MATERIALS AND LABOR
   - All materials are guaranteed for manufacturer defects
   - Labor is warrantied for 1 year from completion date
   - Client responsible for any permits required
   - Any changes to scope of work must be approved in writing

4. LIABILITY AND INSURANCE
   - Contractor carries general liability and workers' compensation insurance
   - Client responsible for securing property during construction
   - Force majeure events may affect timeline and are beyond contractor's control

5. ACCEPTANCE
   - This estimate is valid for 30 days from date of issue
   - Acceptance of this estimate constitutes agreement to these terms
   - Signed estimate or deposit payment indicates acceptance`
    },
    {
      id: 'home_improvement',
      name: 'Home Improvement',
      terms: `TERMS AND CONDITIONS

1. ESTIMATE VALIDITY
   - This estimate is valid for 30 days from the date of issue
   - Prices subject to change after expiration date
   - Final pricing confirmed upon project scheduling

2. PAYMENT SCHEDULE
   - 25% deposit required to schedule work
   - 50% due at project midpoint
   - 25% balance due upon completion
   - Accepted payment methods: cash, check, credit card

3. PROJECT EXECUTION
   - Work performed during normal business hours (8 AM - 6 PM)
   - Weekend/evening work available at premium rates
   - 3-day notice required for project cancellation
   - Change orders require written approval and may affect timeline

4. WARRANTIES
   - 5-year warranty on workmanship
   - Materials carry manufacturer warranty
   - Warranty void if modified by others
   - Annual maintenance recommended

5. GENERAL CONDITIONS
   - Client provides access to work areas and utilities
   - Contractor not responsible for existing hidden conditions
   - Clean-up included in quoted price
   - Permits and inspections additional if required`
    },
    {
      id: 'basic',
      name: 'Basic Service Agreement',
      terms: `TERMS AND CONDITIONS

1. PAYMENT TERMS
   Payment is due upon completion of services unless otherwise agreed in writing. Late payments may be subject to service charges.

2. SCOPE OF WORK
   Services will be performed as described in this estimate. Any additional work requires written authorization and may incur additional charges.

3. WARRANTIES
   We warrant our workmanship for a period of 90 days from completion. Materials carry manufacturer warranties.

4. LIABILITY
   Our liability is limited to the amount paid for services. Client is responsible for securing property and providing safe working conditions.

5. ACCEPTANCE
   This estimate is valid for 30 days. Acceptance of services or payment constitutes agreement to these terms.`
    }
  ];

  useEffect(() => {
    fetchOrganizationSettings();
  }, []);

  const fetchOrganizationSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/organization', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrganization(data);
        
        // Load estimate settings if they exist
        const settings = data.estimate_settings || {};
        setDefaultTerms(settings.default_terms || '');
        setDefaultNotes(settings.default_notes || '');
        setDefaultValidityPeriod(settings.default_validity_period || 30);
        setRequireSignature(settings.require_signature || false);
        setIncludeCompanyLogo(settings.include_company_logo !== false); // Default true
        setAutoCalculateTax(settings.auto_calculate_tax !== false); // Default true
        setDefaultTaxRate(settings.default_tax_rate || 8.25);
      }
    } catch (error) {
      console.error('Error fetching organization settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const estimateSettings = {
        default_terms: defaultTerms,
        default_notes: defaultNotes,
        default_validity_period: defaultValidityPeriod,
        require_signature: requireSignature,
        include_company_logo: includeCompanyLogo,
        auto_calculate_tax: autoCalculateTax,
        default_tax_rate: defaultTaxRate
      };

      const response = await fetch('/api/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          estimate_settings: estimateSettings
        })
      });

      if (response.ok) {
        alert('Settings saved successfully!');
      } else {
        const error = await response.json();
        alert('Failed to save settings: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const loadTemplate = (template: any) => {
    setDefaultTerms(template.terms);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Estimate Settings</h2>
            <p className="text-gray-600">Configure default terms and contract verbiage for your estimates</p>
          </div>
        </div>
        
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contract Templates */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Contract Templates
            </h3>
            <div className="space-y-3">
              {contractTemplates.map((template) => (
                <div key={template.id} className="border border-gray-200 rounded-md p-3">
                  <h4 className="font-medium text-gray-900">{template.name}</h4>
                  <button
                    onClick={() => loadTemplate(template)}
                    className="mt-2 text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 transition-colors"
                  >
                    Load Template
                  </button>
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-start">
                <Info className="w-4 h-4 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Pro Tip</p>
                  <p>Load a template and customize it for your business. These terms will appear on all new estimates by default.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Default Terms and Conditions */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Default Terms & Conditions</h3>
            <textarea
              value={defaultTerms}
              onChange={(e) => setDefaultTerms(e.target.value)}
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your standard terms and conditions..."
            />
          </div>

          {/* Default Notes */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Default Notes</h3>
            <textarea
              value={defaultNotes}
              onChange={(e) => setDefaultNotes(e.target.value)}
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Default notes that appear on estimates (e.g., special instructions, warranty info, etc.)"
            />
          </div>

          {/* General Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">General Settings</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Validity Period (days)
                  </label>
                  <input
                    type="number"
                    value={defaultValidityPeriod}
                    onChange={(e) => setDefaultValidityPeriod(parseInt(e.target.value) || 30)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    max="365"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    value={defaultTaxRate}
                    onChange={(e) => setDefaultTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                    max="50"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={requireSignature}
                    onChange={(e) => setRequireSignature(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Require customer signature on estimates</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={includeCompanyLogo}
                    onChange={(e) => setIncludeCompanyLogo(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Include company logo on estimates</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={autoCalculateTax}
                    onChange={(e) => setAutoCalculateTax(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Auto-calculate tax based on property location</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
