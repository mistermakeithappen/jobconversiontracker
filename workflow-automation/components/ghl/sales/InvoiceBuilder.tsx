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
  product_id?: string;
  product_name?: string;
  unit_label?: string;
}

interface Property {
  id: string;
  nickname?: string;
  full_address: string;
  postal_code: string;
  tax_rate_id?: string;
  custom_tax_rate?: number;
  tax_exempt?: boolean;
}

interface InvoiceBuilderProps {
  invoice?: any;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  opportunityId?: string;
  integrationId?: string;
  estimateId?: string; // If converting from estimate
  onClose: () => void;
  onSave: (invoiceData: any) => void;
}

export default function InvoiceBuilder({
  invoice,
  contactId,
  contactName,
  contactEmail,
  opportunityId,
  integrationId,
  estimateId,
  onClose,
  onSave
}: InvoiceBuilderProps) {
  
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
  
  // Product search states
  const [productSearches, setProductSearches] = useState<{[key: string]: string}>({});
  const [productResults, setProductResults] = useState<{[key: string]: any[]}>({});
  const [showProductDropdowns, setShowProductDropdowns] = useState<{[key: string]: boolean}>({});
  const [productSearchLoading, setProductSearchLoading] = useState<{[key: string]: boolean}>({});
  const [productDebounces, setProductDebounces] = useState<{[key: string]: NodeJS.Timeout}>({});
  const productDropdownRefs = useRef<{[key: string]: HTMLDivElement | null}>({});
  
  // Opportunity search states
  const [opportunitySearch, setOpportunitySearch] = useState('');
  const [opportunityResults, setOpportunityResults] = useState<any[]>([]);
  const [showOpportunityDropdown, setShowOpportunityDropdown] = useState(false);
  const [opportunitySearchLoading, setOpportunitySearchLoading] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);
  const [opportunityDebounce, setOpportunityDebounce] = useState<NodeJS.Timeout | null>(null);
  const opportunityDropdownRef = useRef<HTMLDivElement>(null);
  
  // Basic invoice fields
  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoice_number || '');
  const [invoiceName, setInvoiceName] = useState(invoice?.name || '');
  const [description, setDescription] = useState(invoice?.description || '');
  const [dueDate, setDueDate] = useState(() => {
    if (invoice?.due_date) {
      return new Date(invoice.due_date).toISOString().split('T')[0];
    }
    // Default to 30 days from now
    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 30);
    return defaultDue.toISOString().split('T')[0];
  });
  
  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>(
    invoice?.line_items || [
      {
        id: crypto.randomUUID(),
        description: '',
        quantity: 1,
        unitPrice: 0,
        total: 0
      }
    ]
  );
  
  // Financial
  const [taxRate, setTaxRate] = useState(invoice?.applied_tax_rate ? invoice.applied_tax_rate * 100 : 8.25);
  const [notes, setNotes] = useState(invoice?.notes || '');
  const [paymentTerms, setPaymentTerms] = useState(invoice?.payment_terms || 'Net 30');
  
  // Hidden projection inputs for opportunity tracking (not shown to customer)
  const [projectedMaterialsCost, setProjectedMaterialsCost] = useState(invoice?.metadata?.projected_materials_cost || 0);
  const [projectedLaborCost, setProjectedLaborCost] = useState(invoice?.metadata?.projected_labor_cost || 0);
  const [projectedCommissions, setProjectedCommissions] = useState(invoice?.metadata?.projected_commissions || 0);

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;
  
  // Calculate projected profit for opportunity tracking
  const totalProjectedCosts = projectedMaterialsCost + projectedLaborCost + projectedCommissions;
  const projectedProfit = total - totalProjectedCosts;
  const projectedProfitMargin = total > 0 ? (projectedProfit / total) * 100 : 0;

  useEffect(() => {
    fetchOrganization();
    if (!invoice) {
      generateInvoiceNumber();
    }
    
    // If passed an opportunity ID, set it as selected
    if (opportunityId && !selectedOpportunity) {
      setSelectedOpportunity({ id: opportunityId });
    }
  }, []);

  // Debounced opportunity search
  useEffect(() => {
    if (opportunitySearch.length >= 1 && !selectedOpportunity) {
      if (opportunityDebounce) clearTimeout(opportunityDebounce);
      
      const timeout = setTimeout(() => {
        searchOpportunities(opportunitySearch);
      }, 300);
      
      setOpportunityDebounce(timeout);
    } else {
      setOpportunityResults([]);
      setShowOpportunityDropdown(false);
      setOpportunitySearchLoading(false); // Clear loading when clearing search
    }
    
    return () => {
      if (opportunityDebounce) clearTimeout(opportunityDebounce);
    };
  }, [opportunitySearch, selectedOpportunity]);

  // Debounced contact search
  useEffect(() => {
    if (contactSearch.length >= 2 && !selectedContact) {
      if (searchDebounce) clearTimeout(searchDebounce);
      
      const timeout = setTimeout(() => {
        searchContacts(contactSearch);
      }, 300);
      
      setSearchDebounce(timeout);
    } else {
      setSearchResults([]);
      setShowSearchDropdown(false);
      setSearchLoading(false); // Clear loading when clearing search
    }
    
    return () => {
      if (searchDebounce) clearTimeout(searchDebounce);
    };
  }, [contactSearch, selectedContact]);

  // Load properties when contact changes
  useEffect(() => {
    if (selectedContact?.id) {
      loadProperties(selectedContact.id);
    }
  }, [selectedContact?.id]);

  // Set initial contact if provided
  useEffect(() => {
    if (contactId && contactName && !selectedContact) {
      setSelectedContact({
        id: contactId,
        name: contactName,
        email: contactEmail
      });
      setContactSearch(contactName || '');
    }
  }, [contactId, contactName, contactEmail]);

  // Product search effect for each line item
  useEffect(() => {
    Object.keys(productSearches).forEach(lineItemId => {
      const query = productSearches[lineItemId];
      const currentItem = lineItems.find(item => item.id === lineItemId);
      
      if (query && query.length >= 1 && !currentItem?.product_id) {
        if (productDebounces[lineItemId]) {
          clearTimeout(productDebounces[lineItemId]);
        }
        
        const timeout = setTimeout(() => {
          searchProducts(query, lineItemId);
        }, 300);
        
        setProductDebounces(prev => ({
          ...prev,
          [lineItemId]: timeout
        }));
      } else {
        // Clear search state for this line item
        setProductResults(prev => ({
          ...prev,
          [lineItemId]: []
        }));
        setShowProductDropdowns(prev => ({
          ...prev,
          [lineItemId]: false
        }));
        setProductSearchLoading(prev => ({
          ...prev,
          [lineItemId]: false
        }));
      }
    });
    
    // Cleanup function
    return () => {
      Object.values(productDebounces).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, [productSearches, lineItems]);

  // Handle clicks outside dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (propertyDropdownRef.current && !propertyDropdownRef.current.contains(event.target as Node)) {
        setShowPropertyDropdown(false);
      }
      if (opportunityDropdownRef.current && !opportunityDropdownRef.current.contains(event.target as Node)) {
        setShowOpportunityDropdown(false);
      }
      
      // Handle product dropdowns
      Object.keys(showProductDropdowns).forEach(itemId => {
        const ref = productDropdownRefs.current[itemId];
        if (ref && !ref.contains(event.target as Node)) {
          setShowProductDropdowns(prev => ({
            ...prev,
            [itemId]: false
          }));
        }
      });
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProductDropdowns]);

  const fetchOrganization = async () => {
    try {
      const response = await fetch('/api/organization', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrganization(data.organization);
        
        // Load default invoice settings if available
        const invoiceSettings = data.organization?.invoice_settings;
        if (invoiceSettings && !invoice) {
          setNotes(invoiceSettings.default_notes || '');
          setPaymentTerms(invoiceSettings.default_payment_terms || 'Net 30');
          setTaxRate(invoiceSettings.default_tax_rate || 8.25);
        }
      }
    } catch (error) {
      console.error('Error fetching organization:', error);
    }
  };

  const generateInvoiceNumber = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setInvoiceNumber(`INV-${year}${month}${day}-${random}`);
  };

  const searchContacts = async (query: string) => {
    if (!integrationId || selectedContact) return;
    
    console.log('🔍 Starting contact search, clearing other loading states');
    
    // First, ensure other loading states are cleared
    setOpportunitySearchLoading(false);
    setProductSearchLoading({});
    
    setSearchLoading(true);
    try {
      // Use the same API as EstimateBuilder - it's more comprehensive
      const response = await fetch(
        `/api/sales/contacts/search?q=${encodeURIComponent(query)}&limit=20`,
        { credentials: 'include' }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Contact search response:', data);
        setSearchResults(data.contacts || []);
        // Only show dropdown if we don't have a selected contact
        if (!selectedContact) {
          setShowSearchDropdown(true);
        }
      } else {
        console.error('❌ Contact search failed:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('❌ Error searching contacts:', error);
    } finally {
      setSearchLoading(false);
      console.log('🏁 Contact search finished');
    }
  };

  const searchProducts = async (query: string, lineItemId: string) => {
    if (!integrationId) return;
    
    const currentItem = lineItems.find(item => item.id === lineItemId);
    if (currentItem?.product_id) return; // Already has a product
    
    console.log(`🔍 Starting product search for item ${lineItemId}, clearing other loading states`);
    
    // First, ensure other loading states are cleared
    setSearchLoading(false);
    setOpportunitySearchLoading(false);
    
    // Set loading state ONLY for this specific line item, clear others
    setProductSearchLoading(prev => {
      const newState = { ...prev };
      // Clear all other line item loading states
      Object.keys(newState).forEach(key => {
        if (key !== lineItemId) {
          newState[key] = false;
        }
      });
      newState[lineItemId] = true;
      return newState;
    });
    
    try {
      const response = await fetch(
        `/api/sales/products/search?q=${encodeURIComponent(query)}&limit=10`,
        { credentials: 'include' }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Product search response for item ${lineItemId}:`, data);
        
        // Update results for this specific line item
        setProductResults(prev => ({
          ...prev,
          [lineItemId]: data.products || []
        }));
        
        // Show dropdown for this specific line item only
        setShowProductDropdowns(prev => ({
          ...prev,
          [lineItemId]: true
        }));
      } else {
        console.error(`❌ Product search failed for item ${lineItemId}:`, response.status, response.statusText);
      }
    } catch (error) {
      console.error(`❌ Error searching products for item ${lineItemId}:`, error);
    } finally {
      // Clear loading state ONLY for this specific line item
      setProductSearchLoading(prev => ({
        ...prev,
        [lineItemId]: false
      }));
      console.log(`🏁 Product search finished for item ${lineItemId}`);
    }
  };

  const searchOpportunities = async (query: string) => {
    if (!integrationId || selectedOpportunity) return;
    
    console.log('🔍 Starting opportunity search, clearing other loading states');
    
    // First, ensure other loading states are cleared
    setSearchLoading(false);
    setProductSearchLoading({});
    
    setOpportunitySearchLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        limit: '10'
      });
      
      // If we have a selected contact, filter by that contact
      if (selectedContact?.id) {
        params.append('contactId', selectedContact.id);
      }
      
      const response = await fetch(`/api/sales/opportunities/search?${params}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Opportunity search response:', data);
        setOpportunityResults(data.opportunities || []);
        // Only show dropdown if we don't have a selected opportunity
        if (!selectedOpportunity) {
          setShowOpportunityDropdown(true);
        }
      } else {
        console.error('❌ Opportunity search failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error searching opportunities:', error);
    } finally {
      setOpportunitySearchLoading(false);
      console.log('🏁 Opportunity search finished');
    }
  };

  const loadProperties = async (contactId: string) => {
    try {
      const response = await fetch(`/api/properties?contactId=${contactId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setProperties(data.properties || []);
      }
    } catch (error) {
      console.error('Error loading properties:', error);
    }
  };

  const selectContact = async (contact: any) => {
    setSelectedContact(contact);
    setContactSearch(contact.name || '');
    setShowSearchDropdown(false);
    setSearchResults([]); // Clear search results
    
    // Clear opportunity selection when contact changes
    setSelectedOpportunity(null);
    setOpportunitySearch('');
    
    // Load properties for the selected contact
    if (contact.id) {
      await loadProperties(contact.id);
    }
  };

  const selectOpportunity = (opportunity: any) => {
    setSelectedOpportunity(opportunity);
    setOpportunitySearch(opportunity.name || opportunity.title || `Opportunity ${opportunity.id}` || '');
    setShowOpportunityDropdown(false);
    setOpportunityResults([]); // Clear search results
  };

  const selectProduct = (product: any, lineItemId: string) => {
    const updatedItems = lineItems.map(item => {
      if (item.id === lineItemId) {
        const unitPrice = parseFloat(product.price) || 0;
        const quantity = item.quantity || 1;
        return {
          ...item,
          description: product.name || '',
          unitPrice,
          total: quantity * unitPrice,
          product_id: product.id,
          product_name: product.name || '',
          unit_label: product.unit_label || 'each'
        };
      }
      return item;
    });
    
    setLineItems(updatedItems);
    setProductSearches(prev => ({
      ...prev,
      [lineItemId]: product.name || ''
    }));
    setShowProductDropdowns(prev => ({
      ...prev,
      [lineItemId]: false
    }));
    // Clear search results for this line item
    setProductResults(prev => ({
      ...prev,
      [lineItemId]: []
    }));
  };

  const clearProductSelection = (lineItemId: string) => {
    const updatedItems = lineItems.map(item => {
      if (item.id === lineItemId) {
        return {
          ...item,
          product_id: undefined,
          product_name: undefined,
          unit_label: undefined
        };
      }
      return item;
    });
    
    setLineItems(updatedItems);
    setProductSearches(prev => ({
      ...prev,
      [lineItemId]: ''
    }));
  };

  const handlePropertySelection = async (property: Property) => {
    setSelectedProperty(property);
    setShowPropertyDropdown(false);
    
    // Fetch tax rate for this property
    if (property.custom_tax_rate) {
      setTaxRate(property.custom_tax_rate * 100);
    } else if (property.postal_code) {
      try {
        const response = await fetch(`/api/properties/tax-rate?postalCode=${property.postal_code}`);
        if (response.ok) {
          const data = await response.json();
          if (data.tax_rate) {
            setTaxRate(data.tax_rate * 100);
          }
        }
      } catch (error) {
        console.error('Error fetching tax rate:', error);
      }
    }
  };

  const handleProductSearch = (query: string, lineItemId: string) => {
    setProductSearches(prev => ({
      ...prev,
      [lineItemId]: query
    }));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(items => items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // Recalculate total when quantity or unit price changes
        if (field === 'quantity' || field === 'unitPrice') {
          updatedItem.total = updatedItem.quantity * updatedItem.unitPrice;
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  const addLineItem = () => {
    const newItem: LineItem = {
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
    };
    setLineItems([...lineItems, newItem]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(items => items.filter(item => item.id !== id));
      
      // Clean up product search states for removed item
      setProductSearches(prev => {
        const newSearches = { ...prev };
        delete newSearches[id];
        return newSearches;
      });
      
      setProductResults(prev => {
        const newResults = { ...prev };
        delete newResults[id];
        return newResults;
      });
      
      setShowProductDropdowns(prev => {
        const newDropdowns = { ...prev };
        delete newDropdowns[id];
        return newDropdowns;
      });
    }
  };

  const handleSave = async (status: 'draft' | 'sent' = 'draft') => {
    // Validation
    if (!selectedContact) {
      alert('Please select a contact');
      return;
    }
    
    if (!invoiceName.trim()) {
      alert('Please enter an invoice name');
      return;
    }
    
    if (lineItems.length === 0 || lineItems.every(item => !item.description.trim())) {
      alert('Please add at least one line item');
      return;
    }

    const invoiceData = {
      // GHL identifiers - will be generated by API
      invoice_number: invoiceNumber,
      name: invoiceName,
      description: description,
      
      // Status
      status: status,
      
      // Relationships
      contact_id: selectedContact.id,
      opportunity_id: selectedOpportunity?.id || opportunityId,
      estimate_id: estimateId,
      
      // Financial data
      amount: total,
      line_items: lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total,
        product_id: item.product_id,
        product_name: item.product_name,
        unit_label: item.unit_label
      })),
      
      // Dates
      due_date: dueDate,
      sent_date: status === 'sent' ? new Date().toISOString() : null,
      
      // Additional fields
      payment_terms: paymentTerms,
      notes: notes,
      applied_tax_rate: taxRate / 100,
      
      // Property info
      property_id: selectedProperty?.id,
      property_address: selectedProperty?.full_address,
      
      // Hidden metadata for opportunity tracking
      metadata: {
        projected_materials_cost: projectedMaterialsCost,
        projected_labor_cost: projectedLaborCost,
        projected_commissions: projectedCommissions,
        projected_profit: projectedProfit,
        projected_profit_margin: projectedProfitMargin,
        subtotal: subtotal,
        tax_amount: taxAmount,
        tax_rate: taxRate
      }
    };

    await onSave(invoiceData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {invoice ? 'Edit Invoice' : 'Create New Invoice'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Invoice Details
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="INV-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Name *
                </label>
                <input
                  type="text"
                  value={invoiceName}
                  onChange={(e) => setInvoiceName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Service Invoice"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Brief description of the invoice..."
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <User className="w-5 h-5 mr-2 text-green-600" />
                Contact & Property
              </h3>

              {/* Contact Search */}
              <div className="relative" ref={searchDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact *
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                        <input
                        type="text"
                        value={contactSearch || ''}
                        onChange={(e) => setContactSearch(e.target.value)}
                        onFocus={() => {
                          // Only show dropdown if we have search results and no contact is selected
                          if (contactSearch && searchResults.length > 0 && !selectedContact) {
                            setShowSearchDropdown(true);
                          }
                        }}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Search contacts..."
                        disabled={!!contactId} // Disable if contact was pre-selected
                      />
                  {searchLoading && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </div>
                
                {/* Contact Search Dropdown */}
                {showSearchDropdown && searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto">
                    {searchResults.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => selectContact(contact)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{contact.name}</div>
                        {contact.email && (
                          <div className="text-sm text-gray-600">{contact.email}</div>
                        )}
                        {contact.phone && (
                          <div className="text-sm text-gray-500">{contact.phone}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Property Selection */}
              {properties.length > 0 && (
                <div className="relative" ref={propertyDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Property (Optional)
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowPropertyDropdown(!showPropertyDropdown)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left flex items-center justify-between"
                    >
                      <span className="flex items-center">
                        <Building className="w-4 h-4 mr-2 text-gray-400" />
                        {selectedProperty ? (
                          <span>
                            {selectedProperty.nickname || selectedProperty.full_address}
                          </span>
                        ) : (
                          <span className="text-gray-500">Select a property...</span>
                        )}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  
                  {/* Property Dropdown */}
                  {showPropertyDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto">
                      {properties.map((property) => (
                        <button
                          key={property.id}
                          type="button"
                          onClick={() => handlePropertySelection(property)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">
                            {property.nickname || 'Unnamed Property'}
                          </div>
                          <div className="text-sm text-gray-600">{property.full_address}</div>
                          {property.tax_exempt && (
                            <div className="text-xs text-orange-600">Tax Exempt</div>
                          )}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setShowPropertyDropdown(false);
                          setShowNewPropertyModal(true);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none text-blue-600 border-t border-gray-200"
                      >
                        <Plus className="w-4 h-4 inline mr-2" />
                        Add New Property
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Opportunity Selection */}
              <div className="relative" ref={opportunityDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Opportunity (Optional)
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                        <input
                        type="text"
                        value={opportunitySearch || ''}
                        onChange={(e) => setOpportunitySearch(e.target.value)}
                        onFocus={() => {
                          // Only show dropdown if we have search results and no opportunity is selected
                          if (opportunitySearch && opportunityResults.length > 0 && !selectedOpportunity) {
                            setShowOpportunityDropdown(true);
                          }
                        }}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Search opportunities..."
                        disabled={!!opportunityId} // Disable if opportunity was pre-selected
                      />
                  {opportunitySearchLoading && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </div>
                
                {/* Opportunity Search Dropdown */}
                {showOpportunityDropdown && opportunityResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto">
                    {opportunityResults.map((opportunity) => (
                      <button
                        key={opportunity.id}
                        type="button"
                        onClick={() => selectOpportunity(opportunity)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">
                          {opportunity.name || opportunity.title}
                        </div>
                        {opportunity.contact_name && (
                          <div className="text-sm text-gray-600">{opportunity.contact_name}</div>
                        )}
                        {opportunity.monetary_value && (
                          <div className="text-sm text-green-600">
                            ${parseFloat(opportunity.monetary_value).toLocaleString()}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Line Items</h3>
              <button
                type="button"
                onClick={addLineItem}
                className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Description</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Qty</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Unit Price</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Total</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lineItems.map((item) => (
                    <tr key={item.id}>
                      {/* Product Search + Description */}
                      <td className="py-3 px-2">
                        <div className="space-y-2">
                          {/* Product Search */}
                          <div className="relative" ref={(el) => productDropdownRefs.current[item.id] = el}>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                              <input
                                type="text"
                                value={productSearches[item.id] || ''}
                                onChange={(e) => handleProductSearch(e.target.value, item.id)}
                                onFocus={() => {
                                  // Only show dropdown if we have search results and no product is selected for this item
                                  const hasResults = (productResults[item.id] || []).length > 0;
                                  const hasQuery = productSearches[item.id] && productSearches[item.id].length >= 1;
                                  const noProductSelected = !item.product_id;
                                  
                                  if (hasQuery && hasResults && noProductSelected) {
                                    setShowProductDropdowns(prev => ({ ...prev, [item.id]: true }));
                                  }
                                }}
                                className="w-full pl-10 pr-8 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Search products..."
                              />
                              {productSearchLoading[item.id] && (
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                </div>
                              )}
                              {item.product_id && (
                                                  <button
                    type="button"
                    onClick={() => clearProductSelection(item.id)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                              )}
                            </div>
                            
                            {/* Product Dropdown */}
                            {showProductDropdowns[item.id] && (productResults[item.id] || []).length > 0 && (
                              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto">
                                                              {(productResults[item.id] || []).map((product) => (
                                <button
                                  key={product.id}
                                  type="button"
                                  onClick={() => selectProduct(product, item.id)}
                                  className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                                >
                                  <div className="font-medium text-gray-900">{product.name}</div>
                                  {product.description && (
                                    <div className="text-sm text-gray-600 truncate">{product.description}</div>
                                  )}
                                  <div className="text-sm text-blue-600 font-semibold">
                                    {product.display_price} / {product.unit_label}
                                  </div>
                                </button>
                              ))}
                              </div>
                            )}
                          </div>
                          
                          {/* Manual Description Input */}
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            placeholder="Or enter custom description..."
                          />
                        </div>
                      </td>

                      <td className="py-3 px-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <span className="font-medium">${item.total.toFixed(2)}</span>
                      </td>
                      <td className="py-3 px-2">
                        <button
                          type="button"
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
          </div>

          {/* Financial Summary and Settings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Additional Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Invoice Settings</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Terms
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Due on receipt">Due on receipt</option>
                  <option value="Net 15">Net 15</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 60">Net 60</option>
                  <option value="Net 90">Net 90</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Payment instructions or additional notes..."
                />
              </div>
            </div>

            {/* Financial Summary */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                Invoice Summary
              </h3>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Tax ({taxRate}%):</span>
                  <span className="font-medium">${taxAmount.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold">Total:</span>
                    <span className="text-lg font-bold text-green-600">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Hidden Projection Fields for Opportunity Tracking */}
              {selectedOpportunity && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-3">Opportunity Projections (Internal)</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-blue-700 mb-1">
                        Projected Materials Cost
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={projectedMaterialsCost}
                        onChange={(e) => setProjectedMaterialsCost(parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-blue-200 rounded text-sm"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-blue-700 mb-1">
                        Projected Labor Cost
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={projectedLaborCost}
                        onChange={(e) => setProjectedLaborCost(parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-blue-200 rounded text-sm"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-blue-700 mb-1">
                        Projected Commissions
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={projectedCommissions}
                        onChange={(e) => setProjectedCommissions(parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-blue-200 rounded text-sm"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="border-t border-blue-200 pt-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700">Projected Profit:</span>
                        <span className={`font-semibold ${projectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${projectedProfit.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700">Profit Margin:</span>
                        <span className={`font-semibold ${projectedProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {projectedProfitMargin.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSave('draft')}
              className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => handleSave('sent')}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
            >
              <Send className="w-4 h-4 mr-2" />
              Send Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Property Modal */}
      {showNewPropertyModal && (
        <PropertyModal
          contactId={selectedContact?.id}
          onClose={() => setShowNewPropertyModal(false)}
          onSave={(property: any) => {
            setProperties(prev => [...prev, property]);
            handlePropertySelection(property);
            setShowNewPropertyModal(false);
          }}
        />
      )}
    </div>
  );
}
