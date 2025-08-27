'use client';

import { useState } from 'react';
import { X, Save, Home } from 'lucide-react';

interface PropertyModalProps {
  contactId?: string;
  contactName?: string;
  onClose: () => void;
  onSave: (propertyData: any) => void;
}

export default function PropertyModal({
  contactId,
  contactName,
  onClose,
  onSave
}: PropertyModalProps) {
  const [loading, setLoading] = useState(false);
  const [nickname, setNickname] = useState('');
  const [propertyType, setPropertyType] = useState('residential');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('USA');
  const [taxExempt, setTaxExempt] = useState(false);
  const [taxExemptReason, setTaxExemptReason] = useState('');
  const [customTaxRate, setCustomTaxRate] = useState('');
  const [squareFootage, setSquareFootage] = useState('');
  const [lotSize, setLotSize] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = async () => {
    if (!address1 || !city || !state || !postalCode) {
      alert('Please fill in all required address fields');
      return;
    }

    setLoading(true);

    const propertyData = {
      nickname: nickname || null,
      property_type: propertyType,
      address1,
      address2: address2 || null,
      city,
      state,
      postal_code: postalCode,
      country,
      tax_exempt: taxExempt,
      tax_exempt_reason: taxExempt ? taxExemptReason : null,
      custom_tax_rate: customTaxRate ? parseFloat(customTaxRate) / 100 : null,
      square_footage: squareFootage ? parseInt(squareFootage) : null,
      lot_size: lotSize ? parseFloat(lotSize) : null,
      year_built: yearBuilt ? parseInt(yearBuilt) : null,
      bedrooms: bedrooms ? parseInt(bedrooms) : null,
      bathrooms: bathrooms ? parseFloat(bathrooms) : null,
      notes: notes || null,
      contact_id: contactId || null,
      relationship_type: 'owner'
    };

    try {
      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(propertyData)
      });

      if (response.ok) {
        const data = await response.json();
        onSave(data.property);
        onClose();
      } else {
        const error = await response.json();
        alert(`Failed to create property: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating property:', error);
      alert('Failed to create property');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Home className="w-6 h-6 text-green-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Add New Property</h2>
              {contactName && (
                <p className="text-sm text-gray-600">For {contactName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Property Identification */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Property Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600">Property Nickname (Optional)</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Smith Residence"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Property Type</label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="land">Land</option>
                  <option value="mixed_use">Mixed Use</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Address</h3>
            <div>
              <label className="text-sm text-gray-600">Street Address *</label>
              <input
                type="text"
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                placeholder="123 Main Street"
                required
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Address Line 2</label>
              <input
                type="text"
                value={address2}
                onChange={(e) => setAddress2(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Apt, Suite, Unit, etc."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600">City *</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="New York"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">State *</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="NY"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600">ZIP/Postal Code *</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="10001"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="USA"
                />
              </div>
            </div>
          </div>

          {/* Tax Information */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Tax Information</h3>
            <div className="space-y-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={taxExempt}
                  onChange={(e) => setTaxExempt(e.target.checked)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">Tax Exempt Property</span>
              </label>
              {taxExempt && (
                <div>
                  <label className="text-sm text-gray-600">Tax Exempt Reason</label>
                  <input
                    type="text"
                    value={taxExemptReason}
                    onChange={(e) => setTaxExemptReason(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Non-profit, religious, etc."
                  />
                </div>
              )}
              {!taxExempt && (
                <div>
                  <label className="text-sm text-gray-600">Custom Tax Rate (%) - Leave blank to use ZIP default</label>
                  <input
                    type="number"
                    value={customTaxRate}
                    onChange={(e) => setCustomTaxRate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="8.25"
                    step="0.01"
                    min="0"
                    max="100"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Property Details */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Property Details (Optional)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600">Square Footage</label>
                <input
                  type="number"
                  value={squareFootage}
                  onChange={(e) => setSquareFootage(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="2500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Lot Size (acres)</label>
                <input
                  type="number"
                  value={lotSize}
                  onChange={(e) => setLotSize(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="0.25"
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Year Built</label>
                <input
                  type="number"
                  value={yearBuilt}
                  onChange={(e) => setYearBuilt(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="2000"
                  min="1800"
                  max={new Date().getFullYear()}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Bedrooms</label>
                <input
                  type="number"
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="3"
                  min="0"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Bathrooms</label>
                <input
                  type="number"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="2.5"
                  step="0.5"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm text-gray-600">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md"
              rows={3}
              placeholder="Additional property information..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !address1 || !city || !state || !postalCode}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Create Property</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}