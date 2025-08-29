'use client';

import React from 'react';
import { X, Download, Send, Edit, FileText, Calendar, User, Building, MapPin, DollarSign, CheckCircle, Clock } from 'lucide-react';
import PaymentRecorder from './PaymentRecorder';

interface InvoicePreviewProps {
  invoice: any;
  organization?: any;
  onClose: () => void;
  onEdit?: () => void;
  onSend?: () => void;
  onDownload?: () => void;
  onRecordPayment?: (paymentData: any) => void;
}

export default function InvoicePreview({
  invoice,
  organization,
  onClose,
  onEdit,
  onSend,
  onDownload,
  onRecordPayment
}: InvoicePreviewProps) {
  const [showPaymentRecorder, setShowPaymentRecorder] = React.useState(false);

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

  const lineItems = invoice.line_items || [];
  const subtotal = lineItems.reduce((sum: number, item: any) => sum + (parseFloat(item.total) || 0), 0);
  const taxRate = invoice.applied_tax_rate || 0;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;
  const amountPaid = invoice.amount_paid || 0;
  const remainingBalance = total - amountPaid;
  
  const paymentHistory = invoice.payment_history || [];

  const StatusBadge = ({ status }: { status: string }) => {
    const getStatusColor = (status: string) => {
      switch (status.toLowerCase()) {
        case 'draft': return 'bg-gray-100 text-gray-800';
        case 'sent': return 'bg-blue-100 text-blue-800';
        case 'viewed': return 'bg-indigo-100 text-indigo-800';
        case 'paid': return 'bg-green-100 text-green-800';
        case 'partially_paid': return 'bg-yellow-100 text-yellow-800';
        case 'overdue': return 'bg-red-100 text-red-800';
        case 'void': return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-100 text-gray-800';
      }
    };

    const getStatusIcon = (status: string) => {
      switch (status.toLowerCase()) {
        case 'paid': return <CheckCircle className="w-3 h-3 mr-1" />;
        case 'overdue': return <Clock className="w-3 h-3 mr-1" />;
        default: return null;
      }
    };

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status)}`}>
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const PaymentProgressBar = () => {
    const paymentPercentage = total > 0 ? (amountPaid / total) * 100 : 0;
    
    return (
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Payment Progress</span>
          <span>{paymentPercentage.toFixed(0)}% Paid</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className={`h-3 rounded-full transition-all duration-300 ${
              paymentPercentage === 100 ? 'bg-green-500' : 
              paymentPercentage > 0 ? 'bg-blue-500' : 'bg-gray-300'
            }`}
            style={{ width: `${Math.max(paymentPercentage, 0)}%` }}
          ></div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
      {/* Header Actions */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-gray-900">Invoice Preview</h1>
          <StatusBadge status={invoice.status} />
          {remainingBalance > 0 && (
            <span className="text-sm text-red-600 font-medium">
              Balance Due: {formatCurrency(remainingBalance)}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {onEdit && invoice.status === 'draft' && (
            <button
              onClick={onEdit}
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </button>
          )}
          
          {onSend && (invoice.status === 'draft') && (
            <button
              onClick={onSend}
              className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              <Send className="w-4 h-4 mr-2" />
              Send Invoice
            </button>
          )}
          
          {onRecordPayment && remainingBalance > 0 && (
            <button
              onClick={() => setShowPaymentRecorder(true)}
              className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Record Payment
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

      {/* Invoice Document */}
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          {/* Document Header */}
          <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold mb-2">INVOICE</h1>
                <div className="text-green-100">
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
                <div className="text-green-100 text-sm mb-2">Invoice #</div>
                <div className="text-2xl font-bold">{invoice.invoice_number}</div>
                <div className="text-green-100 text-sm mt-4">Invoice Date</div>
                <div className="text-lg">{formatDate(invoice.created_date)}</div>
                {invoice.due_date && (
                  <>
                    <div className="text-green-100 text-sm mt-2">Due Date</div>
                    <div>{formatDate(invoice.due_date)}</div>
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
                    <User className="w-5 h-5 mr-2 text-green-600" />
                    Bill To
                  </h3>
                  <div className="text-gray-700">
                    <div className="font-semibold text-lg">{invoice.contact_name || 'Contact Name'}</div>
                    {invoice.contact_email && (
                      <div className="mt-1">{invoice.contact_email}</div>
                    )}
                    {invoice.property_address && (
                      <div className="mt-2 flex items-start">
                        <MapPin className="w-4 h-4 mr-1 text-gray-400 mt-0.5" />
                        <div>{invoice.property_address}</div>
                      </div>
                    )}
                  </div>
                </div>
                
                {invoice.name && (
                  <div className="flex-1 ml-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <Building className="w-5 h-5 mr-2 text-green-600" />
                      Project
                    </h3>
                    <div className="text-gray-700">
                      <div className="font-semibold text-lg">{invoice.name}</div>
                      {invoice.description && (
                        <div className="mt-1 text-gray-600">{invoice.description}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Progress (if partially paid) */}
            {amountPaid > 0 && (
              <div className="mb-8 bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Status</h3>
                <PaymentProgressBar />
                
                {paymentHistory.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Payment History</h4>
                    <div className="space-y-2">
                      {paymentHistory.map((payment: any, index: number) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <div>
                            <span className="text-gray-600">{formatDate(payment.date)}</span>
                            <span className="ml-2 text-gray-500">({payment.method})</span>
                          </div>
                          <span className="font-medium text-green-600">
                            {formatCurrency(payment.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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

                    {amountPaid > 0 && (
                      <>
                        <div className="flex justify-between text-green-700">
                          <span>Amount Paid:</span>
                          <span className="font-medium">-{formatCurrency(amountPaid)}</span>
                        </div>
                        
                        <div className="border-t border-gray-300 pt-3">
                          <div className={`flex justify-between text-xl font-bold ${remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            <span>Balance Due:</span>
                            <span>{formatCurrency(remainingBalance)}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Terms and Notes */}
            <div className="space-y-6">
              {invoice.payment_terms && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Payment Terms</h3>
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <p className="text-gray-700 font-medium">{invoice.payment_terms}</p>
                    {invoice.due_date && (
                      <p className="text-sm text-yellow-700 mt-2">
                        Payment is due by {formatDate(invoice.due_date)}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {invoice.notes && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-gray-700 whitespace-pre-line">{invoice.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-12 pt-6 border-t border-gray-200 text-center text-gray-500 text-sm">
              <p>Thank you for your business!</p>
              {remainingBalance > 0 && (
                <p className="mt-1 text-red-600 font-medium">
                  Please remit payment by the due date to avoid late fees.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Recorder Modal */}
      {showPaymentRecorder && onRecordPayment && (
        <PaymentRecorder
          invoice={invoice}
          maxAmount={remainingBalance}
          onClose={() => setShowPaymentRecorder(false)}
          onSave={(paymentData) => {
            onRecordPayment(paymentData);
            setShowPaymentRecorder(false);
          }}
        />
      )}
    </div>
  );
}


