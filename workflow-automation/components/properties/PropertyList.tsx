'use client';

import { useState, useEffect } from 'react';
import { Home, Plus, MapPin, Edit2, Trash2, DollarSign } from 'lucide-react';
import PropertyModal from './PropertyModal';

interface Property {
  id: string;
  nickname?: string;
  full_address: string;
  property_type: string;
  tax_exempt: boolean;
  custom_tax_rate?: number;
  square_footage?: number;
  year_built?: number;
  bedrooms?: number;
  bathrooms?: number;
}

interface PropertyListProps {
  contactId?: string;
  contactName?: string;
}

export default function PropertyList({ contactId, contactName }: PropertyListProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  useEffect(() => {
    if (contactId) {
      fetchProperties();
    }
  }, [contactId]);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/properties?contactId=${contactId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setProperties(data.properties || []);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProperty = async (propertyId: string) => {
    if (!confirm('Are you sure you want to delete this property?')) return;

    try {
      const response = await fetch(`/api/properties/${propertyId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setProperties(properties.filter(p => p.id !== propertyId));
      } else {
        alert('Failed to delete property');
      }
    } catch (error) {
      console.error('Error deleting property:', error);
      alert('Failed to delete property');
    }
  };

  const formatPropertyType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
  };

  if (!contactId) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          Select a contact to view their properties
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Home className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Properties</h3>
            {contactName && (
              <span className="text-sm text-gray-600">for {contactName}</span>
            )}
          </div>
          <button
            onClick={() => setShowPropertyModal(true)}
            className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Property</span>
          </button>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Home className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>No properties found</p>
            <button
              onClick={() => setShowPropertyModal(true)}
              className="mt-3 text-green-600 hover:text-green-700 font-medium text-sm"
            >
              Add first property
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {properties.map((property) => (
              <div
                key={property.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-gray-900">
                        {property.nickname || 'Property'}
                      </h4>
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                        {formatPropertyType(property.property_type)}
                      </span>
                      {property.tax_exempt && (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                          Tax Exempt
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 text-sm text-gray-600">
                      <MapPin className="w-3 h-3" />
                      <span>{property.full_address}</span>
                    </div>
                    <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                      {property.square_footage && (
                        <span>{property.square_footage.toLocaleString()} sq ft</span>
                      )}
                      {property.year_built && (
                        <span>Built {property.year_built}</span>
                      )}
                      {property.bedrooms && (
                        <span>{property.bedrooms} bed</span>
                      )}
                      {property.bathrooms && (
                        <span>{property.bathrooms} bath</span>
                      )}
                      {property.custom_tax_rate && (
                        <div className="flex items-center space-x-1">
                          <DollarSign className="w-3 h-3" />
                          <span>{(property.custom_tax_rate * 100).toFixed(2)}% tax</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDeleteProperty(property.id)}
                      className="text-red-600 hover:text-red-700 p-1"
                      title="Delete property"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPropertyModal && (
        <PropertyModal
          contactId={contactId}
          contactName={contactName}
          onClose={() => setShowPropertyModal(false)}
          onSave={(newProperty) => {
            setShowPropertyModal(false);
            fetchProperties(); // Refresh the list
          }}
        />
      )}
    </div>
  );
}