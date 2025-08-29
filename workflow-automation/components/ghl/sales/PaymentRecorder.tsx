'use client';

import { useState } from 'react';
import { X, DollarSign, Save, CreditCard } from 'lucide-react';

interface PaymentRecorderProps {
  invoice: {
    id: string;
    invoice_number: string;
    amount: number;
    amount_paid: number;
    currency: string;
  };
  onClose: () => void;
  onPaymentRecorded: () => void;
}

const PAYMENT_METHODS = [
  { value: 'card', label: 'Credit/Debit Card', icon: '💳' },
  { value: 'ach', label: 'ACH/Bank Transfer', icon: '🏦' },
  { value: 'check', label: 'Check', icon: '📄' },
  { value: 'venmo', label: 'Venmo', icon: '💜' },
  { value: 'paypal', label: 'PayPal', icon: '💙' },
  { value: 'cashapp', label: 'Cash App', icon: '💚' },
  { value: 'crypto', label: 'Cryptocurrency', icon: '₿' },
  { value: 'cash', label: 'Cash', icon: '💵' },
];

export default function PaymentRecorder({ invoice, onClose, onPaymentRecorded }: PaymentRecorderProps) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const remainingBalance = invoice.amount - invoice.amount_paid;
  const maxPayment = remainingBalance;

  const handleSave = async () => {
    if (!amount || !paymentMethod) {
      alert('Please fill in the payment amount and method.');
      return;
    }

    const paymentAmount = parseFloat(amount);
    if (paymentAmount <= 0) {
      alert('Payment amount must be greater than zero.');
      return;
    }

    if (paymentAmount > maxPayment) {
      alert(`Payment amount cannot exceed remaining balance of $${maxPayment.toFixed(2)}.`);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/sales/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: paymentAmount,
          payment_method: paymentMethod,
          payment_date: new Date(paymentDate).toISOString(),
          transaction_id: transactionId || undefined,
          notes: notes || undefined,
        }),
      });

      if (response.ok) {
        onPaymentRecorded();
        onClose();
      } else {
        const error = await response.json();
        console.error('Error recording payment:', error);
        alert('Failed to record payment: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(value);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Record Payment</h2>
            <p className="text-sm text-gray-600">
              Invoice: {invoice.invoice_number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Payment Info */}
        <div className="p-6 border-b bg-gray-50">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total Amount:</span>
              <div className="font-semibold">{formatCurrency(invoice.amount, invoice.currency)}</div>
            </div>
            <div>
              <span className="text-gray-600">Amount Paid:</span>
              <div className="font-semibold text-green-600">{formatCurrency(invoice.amount_paid, invoice.currency)}</div>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">Remaining Balance:</span>
              <div className="font-semibold text-blue-600 text-lg">{formatCurrency(remainingBalance, invoice.currency)}</div>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <div className="p-6 space-y-4">
          {/* Payment Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="number"
                step="0.01"
                min="0"
                max={maxPayment}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Maximum: {formatCurrency(maxPayment, invoice.currency)}
            </p>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select payment method</option>
              {PAYMENT_METHODS.map(method => (
                <option key={method.value} value={method.value}>
                  {method.icon} {method.label}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Date
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Transaction ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transaction ID (Optional)
            </label>
            <input
              type="text"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="e.g., TXN-123456, CHECK-001, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional notes about this payment..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !amount || !paymentMethod}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? 'Recording...' : 'Record Payment'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
