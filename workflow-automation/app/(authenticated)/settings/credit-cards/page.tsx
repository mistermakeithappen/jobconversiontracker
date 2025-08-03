'use client';

import { useState, useEffect } from 'react';
import { Plus, CreditCard, Edit2, Trash2, Save, X, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface CompanyCreditCard {
  id: string;
  cardName: string;
  lastFourDigits: string;
  cardType: string;
  isReimbursable: boolean;
  notes?: string;
  createdAt: string;
  isActive: boolean;
}

const CARD_TYPES = [
  'Visa',
  'Mastercard', 
  'American Express',
  'Discover',
  'Other'
];

export default function CreditCardsPage() {
  const [cards, setCards] = useState<CompanyCreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [deletingCard, setDeletingCard] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    cardName: '',
    lastFourDigits: '',
    cardType: 'Visa',
    isReimbursable: false,
    notes: ''
  });

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const response = await fetch('/api/company-credit-cards');
      const data = await response.json();
      
      if (response.ok) {
        console.log('Fetched cards:', data.cards);
        setCards(data.cards || []);
      } else {
        setError(data.error || 'Failed to fetch credit cards');
      }
    } catch (error) {
      setError('Failed to fetch credit cards');
      console.error('Error fetching cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate last four digits
    if (!/^\d{4}$/.test(formData.lastFourDigits)) {
      setError('Last four digits must be exactly 4 numbers');
      return;
    }

    try {
      const url = '/api/company-credit-cards';
      const method = editingCard ? 'PUT' : 'POST';
      
      const body = editingCard 
        ? { id: editingCard, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok) {
        await fetchCards();
        resetForm();
        setSuccess(`Credit card ${editingCard ? 'updated' : 'added'} successfully`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to save credit card');
      }
    } catch (error) {
      setError('Failed to save credit card');
      console.error('Error saving card:', error);
    }
  };

  const handleDelete = async (cardId: string) => {
    if (!confirm('Are you sure you want to delete this credit card?')) {
      return;
    }

    setError(null);
    setSuccess(null);
    setDeletingCard(cardId);

    try {
      const response = await fetch(`/api/company-credit-cards?id=${cardId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Immediately remove the card from local state for instant feedback
        setCards(prev => prev.filter(card => card.id !== cardId));
        setSuccess('Credit card deleted successfully');
        setTimeout(() => setSuccess(null), 3000);
        
        // Then refresh from server to ensure consistency
        await fetchCards();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete credit card');
        setTimeout(() => setError(null), 5000);
      }
    } catch (error) {
      setError('Failed to delete credit card');
      console.error('Error deleting card:', error);
      setTimeout(() => setError(null), 5000);
    } finally {
      setDeletingCard(null);
    }
  };

  const handleEdit = (card: CompanyCreditCard) => {
    setFormData({
      cardName: card.cardName,
      lastFourDigits: card.lastFourDigits,
      cardType: card.cardType,
      isReimbursable: false, // Always false for company cards
      notes: card.notes || ''
    });
    setEditingCard(card.id);
    setShowAddForm(true);
  };

  const resetForm = () => {
    setFormData({
      cardName: '',
      lastFourDigits: '',
      cardType: 'Visa',
      isReimbursable: false,
      notes: ''
    });
    setEditingCard(null);
    setShowAddForm(false);
  };

  const getCardColor = (cardType: string) => {
    switch (cardType.toLowerCase()) {
      case 'visa': return 'bg-blue-100 text-blue-800';
      case 'mastercard': return 'bg-orange-100 text-orange-800';
      case 'american express': return 'bg-green-100 text-green-800';
      case 'discover': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <div className="mb-6">
        <Link 
          href="/ghl/settings"
          className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to GHL Settings</span>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Company Credit Cards</h1>
        <p className="text-gray-600 mt-2">
          Manage company credit cards. Expenses on these cards are automatically marked as company expenses (not reimbursable).
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-2">
          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {/* Add Credit Card Button */}
      <div className="mb-6">
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Credit Card</span>
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingCard ? 'Edit Credit Card' : 'Add New Credit Card'}
            </h2>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Card Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.cardName}
                  onChange={(e) => setFormData({ ...formData, cardName: e.target.value })}
                  placeholder="Company Amex, Fleet Card, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last 4 Digits *
                </label>
                <input
                  type="text"
                  required
                  maxLength={4}
                  value={formData.lastFourDigits}
                  onChange={(e) => setFormData({ ...formData, lastFourDigits: e.target.value.replace(/\D/g, '') })}
                  placeholder="1234"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Card Type *
                </label>
                <select
                  required
                  value={formData.cardType}
                  onChange={(e) => setFormData({ ...formData, cardType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                >
                  {CARD_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about this card..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{editingCard ? 'Update' : 'Add'} Card</span>
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Credit Cards List */}
      <div className="space-y-4">
        {cards.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Credit Cards</h3>
            <p className="text-gray-600 mb-4">
              Add your company credit cards to automatically determine reimbursable expenses
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Credit Card</span>
            </button>
          </div>
        ) : (
          cards.map((card) => (
            <div key={card.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <CreditCard className="w-8 h-8 text-gray-400" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-lg font-medium text-gray-900">{card.cardName}</h4>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCardColor(card.cardType)}`}>
                        {card.cardType}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Company Card
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 font-mono">
                      •••• {card.lastFourDigits || 'N/A'}
                    </p>
                    {card.notes && (
                      <p className="text-sm text-gray-600 mt-1">{card.notes}</p>
                    )}
                    <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                      <span>Added {new Date(card.createdAt).toLocaleDateString()}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        card.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {card.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEdit(card)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(card.id)}
                    disabled={deletingCard === card.id}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingCard === card.id ? (
                      <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">How It Works</h3>
            <p className="text-blue-700 text-sm mt-1">
              Company cards listed here are automatically treated as non-reimbursable expenses. Any other card numbers 
              or cash/check payments will be marked as reimbursable to the employee.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}