'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, Trash2, Save, Send, Building, Calendar, FileText, DollarSign, Search, User, ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import PropertyModal from '@/components/properties/PropertyModal';
import WorkflowBreadcrumb from './WorkflowBreadcrumb';

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
  opportunityData?: any; // Full opportunity object for pre-population
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
  opportunityData,
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
      { id: '1', description: '', quantity: 1, unitPrice: 0, total: 0, product_id: undefined, product_name: undefined, unit_label: 'each' }
    ]
  );
  
  // Financial
  const [taxRate, setTaxRate] = useState(estimate?.applied_tax_rate ? estimate.applied_tax_rate * 100 : 8.25); // Default tax rate
  const [notes, setNotes] = useState(estimate?.notes || '');
  const [terms, setTerms] = useState(estimate?.terms || '');
  
  // Hidden projection inputs for opportunity tracking (not shown to customer)
  const [projectedMaterialsCost, setProjectedMaterialsCost] = useState(estimate?.metadata?.projected_materials_cost || 0);
  const [projectedLaborCost, setProjectedLaborCost] = useState(estimate?.metadata?.projected_labor_cost || 0);
  const [projectedCommissions, setProjectedCommissions] = useState(estimate?.metadata?.projected_commissions || 0);

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
    if (!estimate) {
      generateEstimateNumber();
    }
    
    // If passed an opportunity ID, set it as selected
    if (opportunityId && !selectedOpportunity) {
      // Could fetch opportunity details here if needed
      setSelectedOpportunity({ id: opportunityId });
    }
  }, []);

  // Pre-populate from opportunity data
  useEffect(() => {
    if (opportunityData) {
      console.log('Pre-populating estimate from opportunity:', opportunityData);
      
      // Set basic form data using individual state setters
      setEstimateName(opportunityData.name || 'Construction Estimate');
      setDescription(`Estimate for ${opportunityData.name || 'opportunity'}`);
      setNotes(`Generated from opportunity: ${opportunityData.name}\nOpportunity Value: $${opportunityData.monetaryValue?.toLocaleString() || '0'}`);

      // Set contact if available
      if (opportunityData.contactName) {
        setSelectedContact({
          id: opportunityData.contactId || opportunityData.id,
          name: opportunityData.contactName,
          email: opportunityData.contactEmail || '',
          phone: opportunityData.contactPhone || '',
        });
        setContactSearch('');
        setClientName(opportunityData.contactName);
        setClientEmail(opportunityData.contactEmail || '');
        setClientPhone(opportunityData.contactPhone || '');
        setClientContactId(opportunityData.contactId || '');
      }

      // Set opportunity
      if (opportunityData.id) {
        setSelectedOpportunity({
          id: opportunityData.id,
          title: opportunityData.name,
          contact_name: opportunityData.contactName,
          stage: opportunityData.stageName,
          display_value: `$${opportunityData.monetaryValue?.toLocaleString() || '0'}`,
          pipeline_name: opportunityData.pipelineName
        });
        setOpportunitySearch('');
      }

      // Create line items from opportunity value if no existing items
      if (opportunityData.monetaryValue && opportunityData.monetaryValue > 0) {
        const newLineItem = {
          id: uuidv4(),
          description: `Work for ${opportunityData.name}`,
          quantity: 1,
          unit_price: opportunityData.monetaryValue,
          total: opportunityData.monetaryValue,
          product_id: null,
          product_name: '',
        };
        setLineItems([newLineItem]);
      }

      // Set projections if available
      if (opportunityData.materialExpenses || opportunityData.laborExpenses || opportunityData.totalCommissions) {
        setProjectedMaterialsCost(opportunityData.materialExpenses || 0);
        setProjectedLaborCost(opportunityData.laborExpenses || 0);
        setProjectedCommissions(opportunityData.totalCommissions || 0);
      }
    }
  }, [opportunityData]);

  // Debounced opportunity search
  useEffect(() => {
    if (opportunitySearch.length >= 1) {
      if (opportunityDebounce) clearTimeout(opportunityDebounce);
      
      const timeout = setTimeout(() => {
        searchOpportunities(opportunitySearch);
      }, 300);
      
      setOpportunityDebounce(timeout);
    } else {
      setOpportunityResults([]);
      setShowOpportunityDropdown(false);
    }
    
    return () => {
      if (opportunityDebounce) clearTimeout(opportunityDebounce);
    };
  }, [opportunitySearch]);

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

  // Handle clicking outside of product dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      Object.keys(productDropdownRefs.current).forEach(lineItemId => {
        const ref = productDropdownRefs.current[lineItemId];
        if (ref && !ref.contains(event.target as Node)) {
          setShowProductDropdowns(prev => ({ ...prev, [lineItemId]: false }));
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle clicking outside of opportunity dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (opportunityDropdownRef.current && !opportunityDropdownRef.current.contains(event.target as Node)) {
        setShowOpportunityDropdown(false);
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

  // Product search functions
  const searchProducts = async (query: string, lineItemId: string) => {
    setProductSearchLoading(prev => ({ ...prev, [lineItemId]: true }));
    
    try {
      const response = await fetch(`/api/sales/products/search?q=${encodeURIComponent(query)}&limit=10`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setProductResults(prev => ({ ...prev, [lineItemId]: data.products || [] }));
        setShowProductDropdowns(prev => ({ ...prev, [lineItemId]: true }));
      }
    } catch (error) {
      console.error('Error searching products:', error);
    } finally {
      setProductSearchLoading(prev => ({ ...prev, [lineItemId]: false }));
    }
  };

  const handleProductSearch = (query: string, lineItemId: string) => {
    setProductSearches(prev => ({ ...prev, [lineItemId]: query }));
    
    if (query.length >= 1) {
      // Clear existing timeout for this line item
      if (productDebounces[lineItemId]) {
        clearTimeout(productDebounces[lineItemId]);
      }
      
      // Set new timeout
      const timeout = setTimeout(() => {
        searchProducts(query, lineItemId);
      }, 300);
      
      setProductDebounces(prev => ({ ...prev, [lineItemId]: timeout }));
    } else {
      setProductResults(prev => ({ ...prev, [lineItemId]: [] }));
      setShowProductDropdowns(prev => ({ ...prev, [lineItemId]: false }));
    }
  };

  const selectProduct = (product: any, lineItemId: string) => {
    // Update the line item with product details
    setLineItems(lineItems.map(item => {
      if (item.id === lineItemId) {
        return {
          ...item,
          product_id: product.id,
          product_name: product.name,
          description: product.name,
          unitPrice: product.price || 0,
          unit_label: product.unit_label || 'each',
          total: item.quantity * (product.price || 0)
        };
      }
      return item;
    }));
    
    // Update search state
    setProductSearches(prev => ({ ...prev, [lineItemId]: product.name }));
    setShowProductDropdowns(prev => ({ ...prev, [lineItemId]: false }));
  };

  const clearProductSelection = (lineItemId: string) => {
    // Clear product selection for line item
    setLineItems(lineItems.map(item => {
      if (item.id === lineItemId) {
        return {
          ...item,
          product_id: undefined,
          product_name: undefined,
          description: '',
          unit_label: 'each'
        };
      }
      return item;
    }));
    
    setProductSearches(prev => ({ ...prev, [lineItemId]: '' }));
    setShowProductDropdowns(prev => ({ ...prev, [lineItemId]: false }));
  };

  // Opportunity search functions
  const searchOpportunities = async (query: string) => {
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
        setOpportunityResults(data.opportunities || []);
        setShowOpportunityDropdown(true);
      }
    } catch (error) {
      console.error('Error searching opportunities:', error);
    } finally {
      setOpportunitySearchLoading(false);
    }
  };

  const selectOpportunity = (opportunity: any) => {
    setSelectedOpportunity(opportunity);
    setOpportunitySearch(opportunity.title || opportunity.id);
    setShowOpportunityDropdown(false);
  };

  const clearOpportunitySelection = () => {
    setSelectedOpportunity(null);
    setOpportunitySearch('');
    setShowOpportunityDropdown(false);
  };

  const fetchOrganization = async () => {
    try {
      const response = await fetch('/api/organization', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setOrganization(data);
        
        // Load default settings for new estimates
        if (!estimate && data.estimate_settings) {
          const settings = data.estimate_settings;
          setTerms(settings.default_terms || 'Payment due upon completion. This estimate is valid for 30 days.');
          setNotes(settings.default_notes || '');
          if (settings.default_tax_rate) {
            setTaxRate(settings.default_tax_rate);
          }
          if (settings.default_validity_period) {
            const validityDate = new Date(Date.now() + settings.default_validity_period * 24 * 60 * 60 * 1000);
            setValidUntil(validityDate.toISOString().split('T')[0]);
          }
        }
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
      total: 0,
      product_id: undefined,
      product_name: undefined,
      unit_label: 'each'
    }]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
      // Clean up product search state for removed item
      const newSearches = { ...productSearches };
      const newResults = { ...productResults };
      const newDropdowns = { ...showProductDropdowns };
      const newLoading = { ...productSearchLoading };
      const newDebounces = { ...productDebounces };
      
      delete newSearches[id];
      delete newResults[id];
      delete newDropdowns[id];
      delete newLoading[id];
      
      if (newDebounces[id]) clearTimeout(newDebounces[id]);
      delete newDebounces[id];
      delete productDropdownRefs.current[id];
      
      setProductSearches(newSearches);
      setProductResults(newResults);
      setShowProductDropdowns(newDropdowns);
      setProductSearchLoading(newLoading);
      setProductDebounces(newDebounces);
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
    // Validate required fields
    if (!opportunityId && !selectedOpportunity) {
      alert('Please select an opportunity or create a new one before saving the estimate.');
      return;
    }
    
    if (!clientContactId && !clientName) {
      alert('Please select or enter client information.');
      return;
    }
    
    setLoading(true);
    
    const estimateData = {
      estimate_number: estimateNumber,
      name: estimateName,
      description,
      contact_id: clientContactId || contactId || estimate?.contact_id,
      contact_name: clientName,
      contact_email: clientEmail,
      opportunity_id: selectedOpportunity?.id || opportunityId || estimate?.opportunity_id,
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
        tax_amount: taxAmount,
        projected_materials_cost: projectedMaterialsCost,
        projected_labor_cost: projectedLaborCost,
        projected_commissions: projectedCommissions,
        projected_total_costs: totalProjectedCosts,
        projected_profit: projectedProfit,
        projected_profit_margin: projectedProfitMargin
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
        {/* Workflow Breadcrumb */}
        <WorkflowBreadcrumb 
          currentStep="estimate"
          opportunityData={opportunityData}
        />
        
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">
                  {estimate ? 'Edit Estimate' : opportunityData ? 'Create Estimate from Opportunity' : 'Create New Estimate'}
                </h2>
                <p className="text-green-100">
                  {opportunityData 
                    ? `Generate estimate for: ${opportunityData.name}` 
                    : 'Professional Construction Estimate'
                  }
                </p>
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

            {/* Opportunity Selection - Required when not from opportunity */}
            {!opportunityId && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">!</span>
                  </div>
                  <div className="ml-3">
                    <h4 className="font-semibold text-gray-900">Opportunity Assignment Required</h4>
                    <p className="text-sm text-gray-600">Select an existing opportunity or create a new one</p>
                  </div>
                </div>
                
                <div className="relative" ref={opportunityDropdownRef}>
                  <label className="text-sm text-gray-600 font-medium">Search Opportunities</label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={opportunitySearch}
                      onChange={(e) => setOpportunitySearch(e.target.value)}
                      onFocus={() => opportunitySearch.length >= 1 && setShowOpportunityDropdown(true)}
                      className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Type to search opportunities..."
                      required={!selectedOpportunity}
                    />
                    {opportunitySearchLoading && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      </div>
                    )}
                    {selectedOpportunity && (
                      <button
                        onClick={clearOpportunitySelection}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Opportunity Dropdown */}
                  {showOpportunityDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                      {opportunityResults.length > 0 ? (
                        opportunityResults.map((opportunity) => (
                          <button
                            key={opportunity.id}
                            onClick={() => selectOpportunity(opportunity)}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{opportunity.title}</div>
                                <div className="text-sm text-gray-600 mt-1">
                                  {opportunity.contact_name} • {opportunity.stage}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {opportunity.display_value} • {opportunity.pipeline_name}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          {opportunitySearchLoading ? 'Searching...' : 'No opportunities found'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {selectedOpportunity && (
                  <div className="mt-3 p-3 bg-white border border-blue-200 rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{selectedOpportunity.title}</div>
                        <div className="text-sm text-gray-600">
                          {selectedOpportunity.contact_name} • {selectedOpportunity.display_value}
                        </div>
                      </div>
                      <div className="text-xs text-green-600 font-medium">
                        Selected ✓
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Create New Opportunity Button */}
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <button
                    type="button"
                    onClick={() => {
                      // TODO: Implement create new opportunity modal
                      alert('Create new opportunity functionality will be added');
                    }}
                    className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Opportunity for Client
                  </button>
                </div>
              </div>
            )}

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
                          <div className="space-y-2">
                            {/* Product Search */}
                            <div className="relative" ref={(el) => productDropdownRefs.current[item.id] = el}>
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                  type="text"
                                  value={productSearches[item.id] || ''}
                                  onChange={(e) => handleProductSearch(e.target.value, item.id)}
                                  onFocus={() => productSearches[item.id] && productSearches[item.id].length >= 1 && setShowProductDropdowns(prev => ({ ...prev, [item.id]: true }))}
                                  className="w-full pl-10 pr-8 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                  placeholder="Search products..."
                                />
                                {productSearchLoading[item.id] && (
                                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                                  </div>
                                )}
                                {item.product_id && (
                                  <button
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
                                      onClick={() => selectProduct(product, item.id)}
                                      className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                                    >
                                      <div className="font-medium text-gray-900">{product.name}</div>
                                      {product.description && (
                                        <div className="text-sm text-gray-600 truncate">{product.description}</div>
                                      )}
                                      <div className="text-sm text-green-600 font-semibold">
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
                          <div className="text-center">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-center text-sm"
                              min="0"
                              step="0.01"
                            />
                            {item.unit_label && (
                              <div className="text-xs text-gray-500 mt-1">{item.unit_label}</div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">$</span>
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-full pl-6 pr-2 py-1 border border-gray-300 rounded text-right text-sm"
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

            {/* Projected Costs Section (Hidden from Customer) */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">P</span>
                </div>
                <div className="ml-3">
                  <h4 className="font-semibold text-gray-900">Internal Projections</h4>
                  <p className="text-sm text-gray-600">For opportunity tracking - not visible to customer</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Projected Materials Cost</label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={projectedMaterialsCost}
                      onChange={(e) => setProjectedMaterialsCost(parseFloat(e.target.value) || 0)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700">Projected Labor Cost</label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={projectedLaborCost}
                      onChange={(e) => setProjectedLaborCost(parseFloat(e.target.value) || 0)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700">Projected Commissions</label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={projectedCommissions}
                      onChange={(e) => setProjectedCommissions(parseFloat(e.target.value) || 0)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              
              {/* Projected Profit Summary */}
              <div className="bg-white rounded-md border border-yellow-200 p-4">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Revenue:</span>
                    <div className="font-semibold text-green-600">${total.toFixed(2)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Projected Costs:</span>
                    <div className="font-semibold text-red-600">${totalProjectedCosts.toFixed(2)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Projected Profit:</span>
                    <div className={`font-bold ${projectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${projectedProfit.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Profit Margin:</span>
                    <div className={`font-bold ${projectedProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {projectedProfitMargin.toFixed(1)}%
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