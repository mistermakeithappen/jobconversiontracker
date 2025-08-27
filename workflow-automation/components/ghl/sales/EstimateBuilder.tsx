'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, Trash2, Save, Send, Building, Calendar, FileText, DollarSign, Search, User, ChevronDown } from 'lucide-react';
import PropertyModal from '@/components/properties/PropertyModal';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Property {
  id: string;
  nickname?: string;
  full_address: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postal_code: string;
  tax_rate?: number;
  custom_tax_rate?: number;
  tax_exempt?: boolean;
}

interface EstimateBuilderProps {
  estimate?: any;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  opportunityId?: string;
  integrationId?: string;
  onClose: () => void;
  onSave: (estimateData: any) => void;
}

export default function EstimateBuilder({
  estimate,
  contactId,
  contactName,
  contactEmail,
  opportunityId,
  integrationId,
  onClose,
  onSave
}: EstimateBuilderProps) {
  const [loading, setLoading] = useState(false);
  const [organization, setOrganization] = useState<any>(null);
  
  // Contact search states
  const [contactSearch, setContactSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  
  // Property states
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [showNewPropertyModal, setShowNewPropertyModal] = useState(false);
  const propertyDropdownRef = useRef<HTMLDivElement>(null);
  
  // Form fields
  const [estimateNumber, setEstimateNumber] = useState(estimate?.estimate_number || '');
  const [estimateName, setEstimateName] = useState(estimate?.name || 'Construction Estimate');
  const [description, setDescription] = useState(estimate?.description || '');
  const [clientName, setClientName] = useState(contactName || estimate?.contact_name || '');
  const [clientEmail, setClientEmail] = useState(contactEmail || estimate?.contact_email || '');
  const [clientPhone, setClientPhone] = useState(estimate?.metadata?.client_phone || '');
  const [clientContactId, setClientContactId] = useState(contactId || estimate?.contact_id || '');
  const [projectAddress, setProjectAddress] = useState(estimate?.property_address || '');
  const [propertyId, setPropertyId] = useState(estimate?.property_id || '');
  const [estimateDate, setEstimateDate] = useState(
    estimate?.created_date ? new Date(estimate.created_date).toISOString().split('T')[0] : 
    new Date().toISOString().split('T')[0]
  );
  const [validUntil, setValidUntil] = useState(
    estimate?.expiry_date ? new Date(estimate.expiry_date).toISOString().split('T')[0] : 
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  
  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>(
    estimate?.line_items || [
      { id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 }
    ]
  );
  
  // Financial
  const [taxRate, setTaxRate] = useState(estimate?.applied_tax_rate ? estimate.applied_tax_rate * 100 : 8.25); // Default tax rate
  const [notes, setNotes] = useState(estimate?.notes || '');
  const [terms, setTerms] = useState(estimate?.terms || 'Payment due upon completion. This estimate is valid for 30 days.');

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  useEffect(() => {
    fetchOrganization();
    if (!estimate) {
      generateEstimateNumber();
    }
  }, []);

  // Debounced contact search
  useEffect(() => {
    if (contactSearch.length >= 1) { // Lowered from 2 to 1 for better search
      if (searchDebounce) clearTimeout(searchDebounce);
      
      const timeout = setTimeout(() => {
        searchContacts(contactSearch);
      }, 300);
      
      setSearchDebounce(timeout);
    } else {
      setSearchResults([]);
      setShowSearchDropdown(false);
    }
    
    return () => {
      if (searchDebounce) clearTimeout(searchDebounce);
    };
  }, [contactSearch]);

  // Handle clicking outside of search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const searchContacts = async (query: string) => {
    setSearchLoading(true);
    try {
      const response = await fetch(`/api/sales/contacts/search?q=${encodeURIComponent(query)}&limit=20`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Contact search response:', data);
        setSearchResults(data.contacts || []);
        setShowSearchDropdown(true);
      } else {
        console.error('Contact search failed:', response.status, response.statusText);
        const errorData = await response.text();
        console.error('Error response:', errorData);
      }
    } catch (error) {
      console.error('Error searching contacts:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const selectContact = async (contact: any) => {
    setSelectedContact(contact);
    setClientContactId(contact.id);
    setClientName(contact.name);
    setClientEmail(contact.email);
    setClientPhone(contact.phone);
    if (contact.fullAddress) {
      setProjectAddress(contact.fullAddress);
    }
    setContactSearch(contact.name);
    setShowSearchDropdown(false);
    
    // Fetch properties for the selected contact
    await fetchPropertiesForContact(contact.id);
  };
  
  const fetchPropertiesForContact = async (contactId: string) => {
    try {
      const response = await fetch(`/api/properties?contactId=${contactId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setProperties(data.properties || []);
        
        // If only one property, auto-select it
        if (data.properties && data.properties.length === 1) {
          selectProperty(data.properties[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };
  
  const selectProperty = async (property: Property) => {
    setSelectedProperty(property);
    setPropertyId(property.id);
    setProjectAddress(property.full_address);
    setShowPropertyDropdown(false);
    
    // Fetch and apply tax rate for the property
    if (property.tax_exempt) {
      setTaxRate(0);
    } else if (property.custom_tax_rate) {
      setTaxRate(property.custom_tax_rate * 100);
    } else {
      // Try to fetch tax rate by postal code
      try {
        const response = await fetch(`/api/properties/tax-rates?postalCode=${property.postal_code}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.taxRate) {
            setTaxRate(data.taxRate.tax_rate * 100);
          }
        }
      } catch (error) {
        console.error('Error fetching tax rate:', error);
      }
    }
  };

  const clearContactSelection = () => {
    setSelectedContact(null);
    setClientContactId('');
    setClientName('');
    setClientEmail('');
    setClientPhone('');
    setContactSearch('');
    setShowSearchDropdown(false);
    setProperties([]);
    setSelectedProperty(null);
    setPropertyId('');
    setProjectAddress('');
  };

  const fetchOrganization = async () => {
    try {
      const response = await fetch('/api/organization', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setOrganization(data);
      }
    } catch (error) {
      console.error('Error fetching organization:', error);
    }
  };

  const generateEstimateNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setEstimateNumber(`EST-${year}${month}${day}-${random}`);
  };

  const addLineItem = () => {
    const newId = (lineItems.length + 1).toString();
    setLineItems([...lineItems, { 
      id: newId, 
      description: '', 
      quantity: 1, 
      unitPrice: 0, 
      total: 0 
    }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Recalculate total when quantity or unit price changes
        if (field === 'quantity' || field === 'unitPrice') {
          updated.total = updated.quantity * updated.unitPrice;
        }
        return updated;
      }
      return item;
    }));
  };

  const handleSave = async (status: 'draft' | 'sent' = 'draft') => {
    setLoading(true);
    
    const estimateData = {
      estimate_number: estimateNumber,
      name: estimateName,
      description,
      contact_id: clientContactId || contactId || estimate?.contact_id,
      contact_name: clientName,
      contact_email: clientEmail,
      opportunity_id: opportunityId || estimate?.opportunity_id,
      property_id: propertyId || null,
      property_address: projectAddress,
      applied_tax_rate: taxRate / 100, // Store as decimal
      amount: total,
      currency: 'USD',
      status,
      line_items: lineItems.filter(item => item.description), // Only save non-empty items
      created_date: new Date(estimateDate).toISOString(),
      expiry_date: new Date(validUntil).toISOString(),
      sent_date: status === 'sent' ? new Date().toISOString() : null,
      notes,
      terms,
      metadata: {
        project_address: projectAddress,
        client_phone: clientPhone,
        tax_rate: taxRate,
        subtotal,
        tax_amount: taxAmount
      }
    };

    try {
      await onSave(estimateData);
      onClose();
    } catch (error) {
      console.error('Error saving estimate:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">
                  {estimate ? 'Edit Estimate' : 'Create New Estimate'}
                </h2>
                <p className="text-green-100">Professional Construction Estimate</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-green-100 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Company Header Section */}
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  {organization?.company_logo_url ? (
                    <img 
                      src={organization.company_logo_url} 
                      alt="Company Logo" 
                      className="w-24 h-24 object-contain"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                      <Building className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {organization?.company_name || organization?.name || 'Your Company Name'}
                    </h3>
                    {organization?.company_address && (
                      <p className="text-gray-600 mt-1">{organization.company_address}</p>
                    )}
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                      {organization?.company_phone && (
                        <span>{organization.company_phone}</span>
                      )}
                      {organization?.company_email && (
                        <span>{organization.company_email}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">ESTIMATE</div>
                  <div className="mt-2">
                    <label className="text-sm text-gray-600">Estimate #</label>
                    <input
                      type="text"
                      value={estimateNumber}
                      onChange={(e) => setEstimateNumber(e.target.value)}
                      className="block w-48 mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                      placeholder="EST-20240101-001"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Client Information */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">Client Information</h4>
                  {selectedContact && (
                    <button
                      onClick={clearContactSelection}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
                
                {/* Contact Search */}
                <div className="mb-4 relative" ref={searchDropdownRef}>
                  <label className="text-sm text-gray-600">Search Existing Client</label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      onFocus={() => contactSearch.length >= 1 && setShowSearchDropdown(true)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="Type to search contacts..."
                    />
                    {searchLoading && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                      </div>
                    )}
                  </div>
                  
                  {/* Search Dropdown */}
                  {showSearchDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                      {searchResults.length > 0 ? (
                        searchResults.map((contact) => (
                          <button
                            key={contact.id}
                            onClick={() => selectContact(contact)}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{contact.name}</div>
                                {contact.company && (
                                  <div className="text-sm text-gray-600">{contact.company}</div>
                                )}
                                <div className="text-xs text-gray-500 mt-1">
                                  {contact.email && <span className="mr-3">{contact.email}</span>}
                                  {contact.phone && <span>{contact.phone}</span>}
                                </div>
                              </div>
                              <User className="w-4 h-4 text-gray-400 mt-1" />
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          {searchLoading ? 'Searching...' : 'No contacts found'}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-600">Client Name</label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => {
                        setClientName(e.target.value);
                        if (selectedContact) setSelectedContact(null);
                      }}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Email</label>
                    <input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => {
                        setClientEmail(e.target.value);
                        if (selectedContact) setSelectedContact(null);
                      }}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Phone</label>
                    <input
                      type="tel"
                      value={clientPhone}
                      onChange={(e) => {
                        setClientPhone(e.target.value);
                        if (selectedContact) setSelectedContact(null);
                      }}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Project Details</h4>
                <div className="space-y-3">
                  {/* Property Selection */}
                  {selectedContact && (
                    <div>
                      <label className="text-sm text-gray-600">Property</label>
                      <div className="relative mt-1" ref={propertyDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setShowPropertyDropdown(!showPropertyDropdown)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-left flex items-center justify-between hover:bg-gray-50"
                        >
                          <span className={selectedProperty ? 'text-gray-900' : 'text-gray-500'}>
                            {selectedProperty ? 
                              (selectedProperty.nickname || selectedProperty.full_address) : 
                              'Select a property or enter address manually'
                            }
                          </span>
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </button>
                        
                        {showPropertyDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                            {properties.length > 0 ? (
                              <>
                                {properties.map((property) => (
                                  <button
                                    key={property.id}
                                    onClick={() => selectProperty(property)}
                                    className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                                  >
                                    <div className="font-medium text-gray-900">
                                      {property.nickname || 'Property'}
                                    </div>
                                    <div className="text-sm text-gray-600 mt-1">
                                      {property.full_address}
                                    </div>
                                    {property.tax_exempt && (
                                      <div className="text-xs text-green-600 mt-1">Tax Exempt</div>
                                    )}
                                  </button>
                                ))}
                                <button
                                  onClick={() => {
                                    setShowPropertyDropdown(false);
                                    setShowNewPropertyModal(true);
                                  }}
                                  className="w-full px-4 py-3 text-left hover:bg-green-50 focus:bg-green-50 focus:outline-none text-green-600 font-medium flex items-center space-x-2"
                                >
                                  <Plus className="w-4 h-4" />
                                  <span>Add New Property</span>
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setShowPropertyDropdown(false);
                                  setShowNewPropertyModal(true);
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-green-50 focus:bg-green-50 focus:outline-none text-green-600 font-medium"
                              >
                                No properties found. Click to add one.
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {selectedProperty && (
                        <button
                          onClick={() => {
                            setSelectedProperty(null);
                            setPropertyId('');
                            setProjectAddress('');
                            setTaxRate(8.25); // Reset to default
                          }}
                          className="text-sm text-red-600 hover:text-red-700 mt-2"
                        >
                          Clear Property Selection
                        </button>
                      )}
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm text-gray-600">Project Address</label>
                    <input
                      type="text"
                      value={projectAddress}
                      onChange={(e) => {
                        setProjectAddress(e.target.value);
                        if (selectedProperty) {
                          setSelectedProperty(null);
                          setPropertyId('');
                        }
                      }}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="123 Main St, City, State 12345"
                      disabled={!!selectedProperty}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-gray-600">Estimate Date</label>
                      <input
                        type="date"
                        value={estimateDate}
                        onChange={(e) => setEstimateDate(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Valid Until</label>
                      <input
                        type="date"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Project Description</label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Kitchen renovation, bathroom remodel, etc."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">Line Items</h4>
                <button
                  onClick={addLineItem}
                  className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Item</span>
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">Description</th>
                      <th className="text-center py-3 px-2 text-sm font-semibold text-gray-700 w-24">Qty</th>
                      <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700 w-32">Unit Price</th>
                      <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700 w-32">Total</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-3 px-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded"
                            placeholder="Labor, materials, equipment..."
                          />
                        </td>
                        <td className="py-3 px-2">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-center"
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-full pl-6 pr-2 py-1 border border-gray-300 rounded text-right"
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-semibold text-gray-900">
                          ${item.total.toFixed(2)}
                        </td>
                        <td className="py-3 px-2">
                          <button
                            onClick={() => removeLineItem(item.id)}
                            className="text-red-600 hover:text-red-800"
                            disabled={lineItems.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Section */}
              <div className="mt-6 border-t border-gray-200 pt-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-gray-700">
                      <span>Subtotal:</span>
                      <span className="font-semibold">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-700">
                      <div className="flex items-center space-x-2">
                        <span>Tax:</span>
                        <input
                          type="number"
                          value={taxRate}
                          onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                          min="0"
                          step="0.01"
                        />
                        <span className="text-sm">%</span>
                      </div>
                      <span className="font-semibold">${taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
                      <span>Total:</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes and Terms */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-semibold text-gray-700">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md"
                  rows={4}
                  placeholder="Additional notes or special instructions..."
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Terms & Conditions</label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md"
                  rows={4}
                  placeholder="Payment terms, warranty information..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <DollarSign className="inline w-4 h-4 mr-1" />
              Total: <span className="font-bold text-lg text-gray-900">${total.toFixed(2)}</span>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave('draft')}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>Save Draft</span>
              </button>
              <button
                onClick={() => handleSave('sent')}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>Send Estimate</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Property Modal */}
      {showNewPropertyModal && (
        <PropertyModal
          contactId={selectedContact?.id}
          contactName={selectedContact?.name}
          onClose={() => setShowNewPropertyModal(false)}
          onSave={async (newProperty) => {
            setShowNewPropertyModal(false);
            // Add the new property to the list and select it
            const propertyWithFullAddress = {
              ...newProperty,
              full_address: `${newProperty.address1}${newProperty.address2 ? ', ' + newProperty.address2 : ''}, ${newProperty.city}, ${newProperty.state} ${newProperty.postal_code}`
            };
            setProperties([propertyWithFullAddress, ...properties]);
            selectProperty(propertyWithFullAddress);
          }}
        />
      )}
    </div>
  );
}