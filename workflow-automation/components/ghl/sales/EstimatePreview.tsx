'use client';

import React from 'react';
import { X, Download, Send, Edit, FileText, Calendar, User, Building, MapPin } from 'lucide-react';

interface EstimatePreviewProps {
  estimate: any;
  organization?: any;
  onClose: () => void;
  onEdit?: () => void;
  onSend?: () => void;
  onDownload?: () => void;
  onConvertToInvoice?: () => void;
}

export default function EstimatePreview({
  estimate,
  organization,
  onClose,
  onEdit,
  onSend,
  onDownload,
  onConvertToInvoice
}: EstimatePreviewProps) {
  const formatCurrency = (amount: number, currency: string = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const lineItems = estimate.line_items || [];
  const subtotal = lineItems.reduce((sum: number, item: any) => sum + (parseFloat(item.total) || 0), 0);
  const taxRate = estimate.applied_tax_rate || 0;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  const StatusBadge = ({ status }: { status: string }) => {
    const getStatusColor = (status: string) => {
      switch (status.toLowerCase()) {
        case 'draft': return 'bg-gray-100 text-gray-800';
        case 'sent': return 'bg-blue-100 text-blue-800';
        case 'accepted': return 'bg-green-100 text-green-800';
        case 'declined': return 'bg-red-100 text-red-800';
        case 'expired': return 'bg-orange-100 text-orange-800';
        default: return 'bg-gray-100 text-gray-800';
      }
    };

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status)}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
      {/* Header Actions */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-gray-900">Estimate Preview</h1>
          <StatusBadge status={estimate.status} />
        </div>
        <div className="flex items-center space-x-3">
          {onEdit && estimate.status === 'draft' && (
            <button
              onClick={onEdit}
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </button>
          )}
          
          {onSend && (estimate.status === 'draft' || estimate.status === 'declined') && (
            <button
              onClick={onSend}
              className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              <Send className="w-4 h-4 mr-2" />
              Send Estimate
            </button>
          )}
          
          {onConvertToInvoice && (estimate.status === 'accepted' || estimate.status === 'sent') && !estimate.converted_to_invoice && (
            <button
              onClick={onConvertToInvoice}
              className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
            >
              <FileText className="w-4 h-4 mr-2" />
              Convert to Invoice
            </button>
          )}
          
          {onDownload && (
            <button
              onClick={onDownload}
              className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </button>
          )}
          
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Estimate Document */}
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          {/* Document Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold mb-2">ESTIMATE</h1>
                <div className="text-blue-100">
                  {organization?.name && (
                    <div className="text-xl font-semibold">{organization.name}</div>
                  )}
                  {organization?.address && (
                    <div className="mt-1">{organization.address}</div>
                  )}
                  {organization?.phone && (
                    <div>{organization.phone}</div>
                  )}
                  {organization?.email && (
                    <div>{organization.email}</div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-blue-100 text-sm mb-2">Estimate #</div>
                <div className="text-2xl font-bold">{estimate.estimate_number}</div>
                <div className="text-blue-100 text-sm mt-4">Date</div>
                <div className="text-lg">{formatDate(estimate.estimate_date)}</div>
                {estimate.valid_until && (
                  <>
                    <div className="text-blue-100 text-sm mt-2">Valid Until</div>
                    <div>{formatDate(estimate.valid_until)}</div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="p-8">
            {/* Bill To Section */}
            <div className="mb-8">
              <div className="flex justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <User className="w-5 h-5 mr-2 text-blue-600" />
                    Bill To
                  </h3>
                  <div className="text-gray-700">
                    <div className="font-semibold text-lg">{estimate.contact_name || 'Contact Name'}</div>
                    {estimate.contact_email && (
                      <div className="mt-1">{estimate.contact_email}</div>
                    )}
                    {estimate.property_address && (
                      <div className="mt-2 flex items-start">
                        <MapPin className="w-4 h-4 mr-1 text-gray-400 mt-0.5" />
                        <div>{estimate.property_address}</div>
                      </div>
                    )}
                  </div>
                </div>
                
                {estimate.name && (
                  <div className="flex-1 ml-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <Building className="w-5 h-5 mr-2 text-blue-600" />
                      Project
                    </h3>
                    <div className="text-gray-700">
                      <div className="font-semibold text-lg">{estimate.name}</div>
                      {estimate.description && (
                        <div className="mt-1 text-gray-600">{estimate.description}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Items & Services</h3>
              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Description</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">Qty</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Unit Price</th>
                      <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {lineItems.length > 0 ? lineItems.map((item: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{item.description}</div>
                          {item.product_name && (
                            <div className="text-sm text-gray-500 mt-1">{item.product_name}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center text-gray-700">
                          {item.quantity} {item.unit_label || ''}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-700">
                          {formatCurrency(parseFloat(item.unit_price || item.unitPrice) || 0)}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">
                          {formatCurrency(parseFloat(item.total) || 0)}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                          No line items available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals Section */}
            <div className="flex justify-end mb-8">
              <div className="w-80">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="space-y-3">
                    <div className="flex justify-between text-gray-700">
                      <span>Subtotal:</span>
                      <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                    
                    {taxRate > 0 && (
                      <div className="flex justify-between text-gray-700">
                        <span>Tax ({(taxRate * 100).toFixed(2)}%):</span>
                        <span className="font-medium">{formatCurrency(taxAmount)}</span>
                      </div>
                    )}
                    
                    <div className="border-t border-gray-300 pt-3">
                      <div className="flex justify-between text-xl font-bold text-gray-900">
                        <span>Total:</span>
                        <span>{formatCurrency(total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms and Notes */}
            <div className="space-y-6">
              {estimate.terms && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Terms & Conditions</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-700 whitespace-pre-line">{estimate.terms}</p>
                  </div>
                </div>
              )}
              
              {estimate.notes && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-gray-700 whitespace-pre-line">{estimate.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-12 pt-6 border-t border-gray-200 text-center text-gray-500 text-sm">
              <p>This estimate is valid for 30 days from the date issued.</p>
              <p className="mt-1">Thank you for your business!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


