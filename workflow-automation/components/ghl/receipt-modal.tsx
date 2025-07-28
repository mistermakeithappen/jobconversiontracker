'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Save, Receipt, DollarSign, Clock, User } from 'lucide-react';

interface Receipt {
  id: string;
  vendor_name: string;
  description?: string;
  amount: number;
  category: string;
  receipt_date: string;
  receipt_number?: string;
  notes?: string;
  tags?: string[];
  submitted_by?: string;
  reimbursable?: boolean;
  payment_method?: string;
  last_four_digits?: string;
}

interface TimeEntry {
  id: string;
  ghl_user_id: string;
  user_name: string;
  user_email: string;
  hours: number;
  hourly_rate?: number;
  description: string;
  work_date: string;
  total_cost: number;
  created_at: string;
}

interface Commission {
  id: string;
  ghl_user_id: string;
  user_name: string;
  user_email: string;
  commission_type: string;
  commission_percentage: number;
  commission_amount?: number;
  notes?: string;
  created_at: string;
}

interface GHLUser {
  id: string;
  name: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface PaymentAssignment {
  id: string;
  user_id: string;
  ghl_user_name: string;
  ghl_user_email: string;
  payment_type: string;
  hourly_rate?: number;
  annual_salary?: number;
  commission_percentage?: number;
  base_salary?: number;
  overtime_rate?: number;
  notes?: string;
  effective_date: string;
  is_active: boolean;
}

interface ReceiptModalProps {
  opportunity: {
    id: string;
    name: string;
    monetaryValue: number;
    totalExpenses: number;
    netProfit: number;
  };
  integrationId: string;
  onClose: () => void;
  onUpdate: () => void;
}

const EXPENSE_CATEGORIES = [
  'Materials',
  'Labor',
  'Equipment',
  'Subcontractor',
  'Travel',
  'Permits',
  'Insurance',
  'Other'
];

const PAYMENT_METHODS = [
  'Credit Card',
  'Cash',
  'Check',
  'Other'
];

export function ReceiptModal({ opportunity, integrationId, onClose, onUpdate }: ReceiptModalProps) {
  const [activeTab, setActiveTab] = useState<'receipts' | 'time' | 'commissions'>('receipts');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [ghlUsers, setGhlUsers] = useState<GHLUser[]>([]);
  const [paymentAssignments, setPaymentAssignments] = useState<PaymentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLoading, setTimeLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTimeForm, setShowTimeForm] = useState(false);
  const [showCommissionForm, setShowCommissionForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAiEntry, setIsAiEntry] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [editingCommissionId, setEditingCommissionId] = useState<string | null>(null);
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [formData, setFormData] = useState({
    vendor_name: '',
    description: '',
    amount: '',
    category: 'Materials',
    receipt_date: new Date().toISOString().split('T')[0],
    receipt_number: '',
    notes: '',
    submitted_by: '',
    payment_method: 'Credit Card',
    last_four_digits: '',
    reimbursable: false
  });
  const [timeFormData, setTimeFormData] = useState({
    user_id: '',
    user_name: '',
    user_email: '',
    hours: '',
    hourly_rate: '',
    description: '',
    work_date: new Date().toISOString().split('T')[0]
  });
  
  const [commissionFormData, setCommissionFormData] = useState({
    user_id: '',
    user_name: '',
    user_email: '',
    commission_type: 'gross',
    commission_percentage: '',
    notes: ''
  });
  
  const [selectedCommissionUsers, setSelectedCommissionUsers] = useState<{
    user_id: string;
    user_name: string;
    user_email: string;
    commission_type: string;
    commission_percentage: string;
    notes: string;
    override_enabled?: boolean;
  }[]>([]);

  useEffect(() => {
    fetchReceipts();
    fetchTimeEntries();
    fetchCommissions();
    fetchGHLUsers();
    fetchPaymentAssignments();
  }, [opportunity.id]);

  useEffect(() => {
    if (activeTab === 'time') {
      fetchTimeEntries();
    }
    if (activeTab === 'commissions') {
      fetchCommissions();
    }
  }, [activeTab, opportunity.id]);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/receipts?opportunityId=${opportunity.id}`);
      const data = await response.json();
      
      if (response.ok) {
        setReceipts(data.receipts || []);
      }
    } catch (error) {
      console.error('Error fetching receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGHLUsers = async () => {
    try {
      const response = await fetch('/api/integrations/automake/users');
      const data = await response.json();
      if (response.ok) {
        setGhlUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching GHL users:', error);
    }
  };

  const fetchPaymentAssignments = async () => {
    try {
      const response = await fetch('/api/user-payment-assignments');
      const data = await response.json();
      if (response.ok) {
        setPaymentAssignments(data.assignments || []);
      }
    } catch (error) {
      console.error('Error fetching payment assignments:', error);
    }
  };

  const getUserPaymentInfo = (ghlUserId: string) => {
    // First try to match by user_id
    let assignment = paymentAssignments.find(assignment => 
      assignment.user_id === ghlUserId && assignment.is_active
    );
    
    // If not found, try to match by email
    if (!assignment) {
      const user = ghlUsers.find(u => u.id === ghlUserId);
      if (user) {
        assignment = paymentAssignments.find(assignment => 
          assignment.ghl_user_email === user.email && assignment.is_active
        );
      }
    }
    
    return assignment;
  };

  const calculateHourlyRate = (paymentInfo: PaymentAssignment | undefined) => {
    if (!paymentInfo) return '';
    
    switch (paymentInfo.payment_type) {
      case 'hourly':
        return paymentInfo.hourly_rate?.toString() || '';
      case 'salary':
        // Convert annual salary to hourly rate (assuming 2080 work hours per year)
        return paymentInfo.annual_salary ? (paymentInfo.annual_salary / 2080).toFixed(2) : '';
      case 'hybrid':
        // For hybrid, use the hourly rate if available, otherwise calculate from base salary
        return paymentInfo.hourly_rate?.toString() || 
               (paymentInfo.base_salary ? (paymentInfo.base_salary / 2080).toFixed(2) : '');
      case 'contractor':
        return paymentInfo.hourly_rate?.toString() || '';
      default:
        return '';
    }
  };

  const getPaymentTypeDisplay = (paymentInfo: PaymentAssignment | undefined) => {
    if (!paymentInfo) return '';
    
    switch (paymentInfo.payment_type) {
      case 'hourly':
        return `Hourly - $${paymentInfo.hourly_rate}/hr`;
      case 'salary':
        return `Salary - $${paymentInfo.annual_salary?.toLocaleString()}/year`;
      case 'commission_gross':
        return `Commission - ${paymentInfo.commission_percentage}% of gross`;
      case 'commission_profit':
        return `Commission - ${paymentInfo.commission_percentage}% of profit`;
      case 'hybrid':
        return `Hybrid - $${paymentInfo.base_salary?.toLocaleString()}/year + ${paymentInfo.commission_percentage}% commission`;
      case 'contractor':
        return `Contractor - $${paymentInfo.hourly_rate}/hr`;
      default:
        return 'No payment structure set';
    }
  };

  const fetchTimeEntries = async () => {
    setTimeLoading(true);
    try {
      const response = await fetch(`/api/time-entries?opportunityId=${opportunity.id}`);
      const data = await response.json();
      if (response.ok) {
        setTimeEntries(data.timeEntries || []);
      }
    } catch (error) {
      console.error('Error fetching time entries:', error);
    } finally {
      setTimeLoading(false);
    }
  };
  
  const fetchCommissions = async () => {
    setCommissionLoading(true);
    try {
      const response = await fetch(`/api/opportunity-commissions?opportunityId=${opportunity.id}`);
      const data = await response.json();
      if (response.ok) {
        console.log('Fetched commissions for opportunity:', opportunity.id, data.commissions);
        setCommissions(data.commissions || []);
      }
    } catch (error) {
      console.error('Error fetching commissions:', error);
    } finally {
      setCommissionLoading(false);
    }
  };

  const handleTimeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Time form submitted');
    console.log('Form data:', timeFormData);
    
    // Validation
    if (!timeFormData.user_id || !timeFormData.hours || !timeFormData.work_date) {
      console.error('Missing required fields:', { 
        user_id: timeFormData.user_id, 
        hours: timeFormData.hours, 
        work_date: timeFormData.work_date 
      });
      alert('Please fill in all required fields (Team Member, Hours, Work Date)');
      return;
    }
    
    try {
      setTimeLoading(true);
      const url = editingTimeId ? '/api/time-entries' : '/api/time-entries';
      const method = editingTimeId ? 'PUT' : 'POST';
      
      const body = editingTimeId 
        ? { 
            id: editingTimeId, 
            ...timeFormData, 
            hours: parseFloat(timeFormData.hours),
            hourly_rate: timeFormData.hourly_rate ? parseFloat(timeFormData.hourly_rate) : undefined
          }
        : {
            opportunityId: opportunity.id,
            integrationId,
            ...timeFormData,
            hours: parseFloat(timeFormData.hours),
            hourly_rate: timeFormData.hourly_rate ? parseFloat(timeFormData.hourly_rate) : undefined
          };

      console.log('Sending request to:', url);
      console.log('Method:', method);
      console.log('Body:', body);

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      console.log('Response status:', response.status);
      const responseData = await response.json();
      console.log('Response data:', responseData);

      if (response.ok) {
        await fetchTimeEntries();
        resetTimeForm();
        onUpdate();
        console.log('Time entry saved successfully');
      } else {
        console.error('Error response:', responseData);
        alert(`Error saving time entry: ${responseData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving time entry:', error);
      alert('Failed to save time entry. Please try again.');
    } finally {
      setTimeLoading(false);
    }
  };

  const resetTimeForm = () => {
    setTimeFormData({
      user_id: '',
      user_name: '',
      user_email: '',
      hours: '',
      hourly_rate: '',
      description: '',
      work_date: new Date().toISOString().split('T')[0]
    });
    setShowTimeForm(false);
    setEditingTimeId(null);
  };

  const handleDeleteTimeEntry = async (timeEntryId: string) => {
    if (!confirm('Are you sure you want to delete this time entry?')) return;
    
    try {
      const response = await fetch(`/api/time-entries?id=${timeEntryId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await fetchTimeEntries();
        onUpdate();
      }
    } catch (error) {
      console.error('Error deleting time entry:', error);
    }
  };
  
  const handleCommissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Different validation for edit vs create
    if (editingCommissionId) {
      // Validate edit form data
      if (!commissionFormData.commission_percentage || parseFloat(commissionFormData.commission_percentage) <= 0) {
        alert('Please enter a valid commission percentage');
        return;
      }
    } else {
      // Validate new commission data
      if (selectedCommissionUsers.length === 0) {
        alert('Please select at least one team member');
        return;
      }
      
      // Validate all commission percentages
      for (const user of selectedCommissionUsers) {
        if (!user.commission_percentage || parseFloat(user.commission_percentage) <= 0) {
          alert(`Please enter a valid commission percentage for ${user.user_name}`);
          return;
        }
      }
    }
    
    try {
      setCommissionLoading(true);
      
      if (editingCommissionId) {
        // Editing single commission
        const url = '/api/opportunity-commissions';
        const method = 'PUT';
        
        const body = { 
          id: editingCommissionId, 
          commissionType: commissionFormData.commission_type,
          commissionPercentage: parseFloat(commissionFormData.commission_percentage),
          notes: commissionFormData.notes
        };
        
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        
        if (!response.ok) {
          const responseData = await response.json();
          alert(`Error updating commission: ${responseData.error || 'Unknown error'}`);
          return;
        }
      } else {
        // Creating multiple commissions
        const errors = [];
        
        for (const user of selectedCommissionUsers) {
          // Skip users without a commission percentage
          if (!user.commission_percentage || user.commission_percentage === '') {
            errors.push(`${user.user_name} - Commission percentage is required`);
            continue;
          }
          
          const body = {
            opportunityId: opportunity.id,
            integrationId,
            ghlUserId: user.user_id,
            userName: user.user_name,
            userEmail: user.user_email,
            commissionType: user.commission_type,
            commissionPercentage: parseFloat(user.commission_percentage),
            notes: user.notes
          };
          
          try {
            const response = await fetch('/api/opportunity-commissions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
            
            if (!response.ok) {
              const responseData = await response.json();
              if (response.status === 409) {
                errors.push(`${user.user_name} already has a commission assignment`);
              } else {
                errors.push(`Failed to assign commission to ${user.user_name}`);
              }
            }
          } catch (error) {
            errors.push(`Error assigning commission to ${user.user_name}`);
          }
        }
        
        if (errors.length > 0) {
          alert('Some commissions could not be assigned:\n' + errors.join('\n'));
        }
      }
      
      await fetchCommissions();
      resetCommissionForm();
      // Force parent component to refresh opportunity data immediately
      console.log('Triggering parent refresh after commission save...');
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error saving commissions:', error);
      alert('Failed to save commissions. Please try again.');
    } finally {
      setCommissionLoading(false);
    }
  };
  
  const resetCommissionForm = () => {
    setCommissionFormData({
      user_id: '',
      user_name: '',
      user_email: '',
      commission_type: 'gross',
      commission_percentage: '',
      notes: ''
    });
    setSelectedCommissionUsers([]);
    setShowCommissionForm(false);
    setEditingCommissionId(null);
  };
  
  const handleDeleteCommission = async (commissionId: string) => {
    if (!confirm('Are you sure you want to delete this commission assignment?')) return;
    
    try {
      const response = await fetch(`/api/opportunity-commissions?id=${commissionId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await fetchCommissions();
        // Force parent component to refresh opportunity data immediately
        console.log('Triggering parent refresh after commission deletion...');
        if (onUpdate) {
          onUpdate();
        }
      }
    } catch (error) {
      console.error('Error deleting commission:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingId ? '/api/receipts' : '/api/receipts';
      const method = editingId ? 'PUT' : 'POST';
      
      const body = editingId 
        ? { id: editingId, ...formData, amount: parseFloat(formData.amount) }
        : {
            opportunityId: opportunity.id,
            integrationId,
            ...formData,
            amount: parseFloat(formData.amount)
          };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        await fetchReceipts();
        resetForm();
        onUpdate();
      }
    } catch (error) {
      console.error('Error saving receipt:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this receipt?')) return;
    
    try {
      const response = await fetch(`/api/receipts?id=${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchReceipts();
        onUpdate();
      }
    } catch (error) {
      console.error('Error deleting receipt:', error);
    }
  };

  const handleEdit = (receipt: Receipt) => {
    setFormData({
      vendor_name: receipt.vendor_name,
      description: receipt.description || '',
      amount: receipt.amount.toString(),
      category: receipt.category,
      receipt_date: receipt.receipt_date,
      receipt_number: receipt.receipt_number || '',
      notes: receipt.notes || '',
      submitted_by: receipt.submitted_by || '',
      payment_method: receipt.payment_method || 'Credit Card',
      last_four_digits: receipt.last_four_digits || '',
      reimbursable: receipt.reimbursable || false
    });
    setEditingId(receipt.id);
    setShowAddForm(true);
  };

  const resetForm = () => {
    setFormData({
      vendor_name: '',
      description: '',
      amount: '',
      category: 'Materials',
      receipt_date: new Date().toISOString().split('T')[0],
      receipt_number: '',
      notes: '',
      submitted_by: '',
      payment_method: 'Credit Card',
      last_four_digits: '',
      reimbursable: false
    });
    setEditingId(null);
    setShowAddForm(false);
    setIsAiEntry(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const calculateLaborCost = () => {
    return timeEntries.reduce((total, entry) => {
      return total + (entry.total_cost || 0);
    }, 0);
  };

  const calculateMaterialExpenses = () => {
    return receipts.reduce((total, receipt) => {
      return total + receipt.amount;
    }, 0);
  };

  const calculateTotalCommissions = () => {
    
    const grossCommissions = commissions
      .filter(c => c.commission_type === 'gross')
      .reduce((sum, c) => sum + (opportunity.monetaryValue * c.commission_percentage / 100), 0);
    
    const materialExpenses = calculateMaterialExpenses();
    const laborExpenses = calculateLaborCost();
    const baseExpenses = materialExpenses + laborExpenses + grossCommissions;
    const netBeforeCommissions = opportunity.monetaryValue - baseExpenses;
    
    const profitCommissions = commissions
      .filter(c => c.commission_type === 'profit')
      .reduce((sum, c) => sum + (Math.max(0, netBeforeCommissions) * c.commission_percentage / 100), 0);
    
    const totalCommissions = grossCommissions + profitCommissions;
    
    return totalCommissions;
  };

  const calculateTotalCosts = () => {
    return calculateLaborCost() + calculateMaterialExpenses() + calculateTotalCommissions();
  };

  const calculateNetProfit = () => {
    const materialExpenses = calculateMaterialExpenses();
    const laborExpenses = calculateLaborCost();
    
    // Calculate gross-based commissions first
    const grossCommissions = commissions
      .filter(c => c.commission_type === 'gross')
      .reduce((sum, c) => sum + (opportunity.monetaryValue * c.commission_percentage / 100), 0);
    
    // Calculate base expenses (material + labor + gross commissions)
    const baseExpenses = materialExpenses + laborExpenses + grossCommissions;
    const netBeforeCommissions = opportunity.monetaryValue - baseExpenses;
    
    // Calculate profit-based commissions on the net profit (before profit commissions)
    const profitCommissions = commissions
      .filter(c => c.commission_type === 'profit')
      .reduce((sum, c) => sum + (Math.max(0, netBeforeCommissions) * c.commission_percentage / 100), 0);
    
    // Final net profit after all expenses and commissions
    return opportunity.monetaryValue - baseExpenses - profitCommissions;
  };

  const processReceiptWithAI = async (file: File) => {
    setAiProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('opportunityId', opportunity.id);
      formData.append('integrationId', integrationId);

      const response = await fetch('/api/receipts/process-image', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (response.ok && data.success && data.receiptData) {
        // Pre-fill the form with AI-extracted data
        setFormData({
          vendor_name: data.receiptData.vendor_name || '',
          description: data.receiptData.description || '',
          amount: data.receiptData.amount?.toString() || '',
          category: data.receiptData.category || 'Materials',
          receipt_date: data.receiptData.receipt_date || new Date().toISOString().split('T')[0],
          receipt_number: data.receiptData.receipt_number || '',
          notes: '',
          submitted_by: '',
          payment_method: 'Credit Card',
          last_four_digits: '',
          reimbursable: false
        });
        
        // Switch to manual form with pre-filled data
        setIsAiEntry(false);
        alert('Receipt processed successfully! Please review and submit the pre-filled form.');
      } else {
        console.error('AI processing failed:', data);
        alert(`AI processing failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error processing receipt:', error);
      alert('Failed to process receipt image. Please try again.');
    } finally {
      setAiProcessing(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Project Management</h2>
              <p className="text-gray-600 mt-1">{opportunity.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="mt-4">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('receipts')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'receipts'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Receipt className="w-4 h-4" />
                  <span>Receipts</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('time')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'time'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>Time Tracking</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('commissions')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'commissions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4" />
                  <span>Commissions</span>
                </div>
              </button>
            </nav>
          </div>
          
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-600">Opportunity Value</p>
              <p className="text-lg font-bold text-blue-900">{formatCurrency(opportunity.monetaryValue)}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <p className="text-xs text-orange-600">Labor Cost</p>
              <p className="text-lg font-bold text-orange-900">{formatCurrency(calculateLaborCost())}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-xs text-purple-600">Material Expenses</p>
              <p className="text-lg font-bold text-purple-900">{formatCurrency(calculateMaterialExpenses())}</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3">
              <p className="text-xs text-yellow-600">Total Commissions</p>
              <p className="text-lg font-bold text-yellow-900">{formatCurrency(calculateTotalCommissions())}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-xs text-red-600">Total Costs</p>
              <p className="text-lg font-bold text-red-900">{formatCurrency(calculateTotalCosts())}</p>
            </div>
            <div className={`${calculateNetProfit() >= 0 ? 'bg-green-50' : 'bg-red-50'} rounded-lg p-3`}>
              <p className={`text-xs ${calculateNetProfit() >= 0 ? 'text-green-600' : 'text-red-600'}`}>Net Profit</p>
              <p className={`text-lg font-bold ${calculateNetProfit() >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                {formatCurrency(calculateNetProfit())}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'receipts' && (
            <>
              {/* Add Receipt Options */}
              {!showAddForm && (
                <div className="mb-4 flex space-x-3">
                  <button
                    onClick={() => {
                      setIsAiEntry(false);
                      setShowAddForm(true);
                    }}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Enter Receipt Manually</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsAiEntry(true);
                      setShowAddForm(true);
                    }}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Enter Receipt with AI</span>
                  </button>
                </div>
              )}

          {/* Add/Edit Form */}
          {showAddForm && !isAiEntry && (
            <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vendor Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.vendor_name}
                    onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.receipt_date}
                    onChange={(e) => setFormData({ ...formData, receipt_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Receipt Number
                  </label>
                  <input
                    type="text"
                    value={formData.receipt_number}
                    onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Submitted By *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.submitted_by}
                    onChange={(e) => setFormData({ ...formData, submitted_by: e.target.value })}
                    placeholder="Name of person who submitted"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method *
                  </label>
                  <select
                    required
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  >
                    {PAYMENT_METHODS.map(method => (
                      <option key={method} value={method.toLowerCase().replace(' ', '_')}>{method}</option>
                    ))}
                  </select>
                </div>
                
                {formData.payment_method === 'credit_card' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last 4 Digits
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={formData.last_four_digits}
                      onChange={(e) => setFormData({ ...formData, last_four_digits: e.target.value.replace(/\D/g, '') })}
                      placeholder="1234"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      For automatic reimbursable determination
                    </p>
                  </div>
                )}
                
                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="reimbursable"
                    checked={formData.reimbursable}
                    onChange={(e) => setFormData({ ...formData, reimbursable: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="reimbursable" className="text-sm font-medium text-gray-700">
                    Reimbursable expense
                  </label>
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingId ? 'Update' : 'Save'} Receipt</span>
                </button>
              </div>
            </form>
          )}

          {/* AI Receipt Entry Form */}
          {showAddForm && isAiEntry && (
            <div className="bg-purple-50 rounded-lg p-4 mb-6 border border-purple-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-purple-900">AI Receipt Entry</h3>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setIsAiEntry(false);
                  }}
                  className="text-purple-600 hover:text-purple-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="border-2 border-dashed border-purple-300 rounded-lg p-6 text-center">
                  {aiProcessing ? (
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
                      <p className="mt-4 text-sm font-medium text-purple-900">Processing receipt with AI...</p>
                      <p className="mt-1 text-xs text-purple-600">This may take a few seconds</p>
                    </div>
                  ) : (
                    <>
                      <svg className="mx-auto h-12 w-12 text-purple-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="mt-4">
                        <label htmlFor="receipt-upload" className="cursor-pointer">
                          <span className="mt-2 block text-sm font-medium text-purple-900">
                            Drop receipt image here or click to upload
                          </span>
                          <span className="mt-1 block text-xs text-purple-600">
                            PNG, JPG, PDF up to 10MB
                          </span>
                        </label>
                        <input
                          id="receipt-upload"
                          name="receipt-upload"
                          type="file"
                          className="sr-only"
                          accept="image/*,.pdf"
                          disabled={aiProcessing}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              console.log('Receipt file selected:', file);
                              processReceiptWithAI(file);
                            }
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex">
                    <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="ml-3">
                      <p className="text-sm text-blue-700">
                        <strong>How it works:</strong> Upload a receipt image and our AI will automatically extract vendor name, amount, date, and description to pre-fill the form for you.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setIsAiEntry(false);
                    }}
                    className="px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors"
                  >
                    Switch to Manual Entry
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setIsAiEntry(false);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Receipts List */}
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading receipts...</p>
            </div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No receipts added yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {receipts.map((receipt) => (
                <div key={receipt.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-medium text-gray-900">{receipt.vendor_name}</h4>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                          {receipt.category}
                        </span>
                        {receipt.reimbursable && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                            Reimbursable
                          </span>
                        )}
                        {receipt.payment_method && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                            {receipt.payment_method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            {receipt.last_four_digits && ` ••••${receipt.last_four_digits}`}
                          </span>
                        )}
                      </div>
                      {receipt.description && (
                        <p className="text-sm text-gray-600 mt-1">{receipt.description}</p>
                      )}
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                        <span>{new Date(receipt.receipt_date).toLocaleDateString()}</span>
                        {receipt.receipt_number && (
                          <span>Receipt #{receipt.receipt_number}</span>
                        )}
                        {receipt.submitted_by && (
                          <span>Submitted by {receipt.submitted_by}</span>
                        )}
                      </div>
                      {receipt.notes && (
                        <p className="text-sm text-gray-600 mt-2 italic">{receipt.notes}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <p className="text-lg font-bold text-red-600">
                        -{formatCurrency(receipt.amount)}
                      </p>
                      <button
                        onClick={() => handleEdit(receipt)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(receipt.id)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
            </>
          )}

          {activeTab === 'time' && (
            <>
              {/* Add Time Entry Button */}
              {!showTimeForm && (
                <button
                  onClick={() => setShowTimeForm(true)}
                  className="mb-4 inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Time Entry</span>
                </button>
              )}

              {/* Add/Edit Time Form */}
              {showTimeForm && (
                <form onSubmit={handleTimeSubmit} className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Team Member *
                      </label>
                      <select
                        required
                        value={timeFormData.user_id}
                        onChange={(e) => {
                          const selectedUser = ghlUsers.find(u => u.id === e.target.value);
                          const paymentInfo = getUserPaymentInfo(e.target.value);
                          const calculatedRate = calculateHourlyRate(paymentInfo);
                          
                          setTimeFormData({ 
                            ...timeFormData, 
                            user_id: e.target.value,
                            user_name: selectedUser?.name || '',
                            user_email: selectedUser?.email || '',
                            hourly_rate: calculatedRate
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                      >
                        <option value="">Select team member</option>
                        {ghlUsers
                          .filter(user => {
                            const paymentInfo = getUserPaymentInfo(user.id);
                            return paymentInfo && (
                              paymentInfo.payment_type === 'hourly' ||
                              paymentInfo.payment_type === 'salary' ||
                              paymentInfo.payment_type === 'contractor' ||
                              paymentInfo.payment_type === 'hybrid' // Hybrid can have hourly component
                            );
                          })
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(user => {
                            const paymentInfo = getUserPaymentInfo(user.id);
                            const paymentDisplay = getPaymentTypeDisplay(paymentInfo);
                            return (
                              <option key={user.id} value={user.id}>
                                {user.name} - {paymentDisplay}
                              </option>
                            );
                          })}
                      </select>
                      {timeFormData.user_id && (
                        <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-700">
                            {getPaymentTypeDisplay(getUserPaymentInfo(timeFormData.user_id))}
                          </p>
                        </div>
                      )}
                      {ghlUsers.filter(user => {
                        const paymentInfo = getUserPaymentInfo(user.id);
                        return paymentInfo && (
                          paymentInfo.payment_type === 'hourly' ||
                          paymentInfo.payment_type === 'salary' ||
                          paymentInfo.payment_type === 'contractor' ||
                          paymentInfo.payment_type === 'hybrid'
                        );
                      }).length === 0 && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-700">
                            Don&apos;t see someone?{' '}
                            <a 
                              href="/ghl/settings" 
                              className="text-blue-600 hover:text-blue-800 underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Assign a payment structure here
                            </a>
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Hours *
                      </label>
                      <input
                        type="number"
                        step="0.25"
                        required
                        value={timeFormData.hours}
                        onChange={(e) => setTimeFormData({ ...timeFormData, hours: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                        placeholder="8.0"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Hourly Rate {timeFormData.hourly_rate && <span className="text-green-600">(Auto-calculated)</span>}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={timeFormData.hourly_rate}
                        onChange={(e) => setTimeFormData({ ...timeFormData, hourly_rate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                        placeholder="Rate will auto-populate based on payment structure"
                      />
                      {timeFormData.hourly_rate && (
                        <p className="text-xs text-gray-500 mt-1">
                          Rate auto-calculated from payment structure. You can override if needed.
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Work Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={timeFormData.work_date}
                        onChange={(e) => setTimeFormData({ ...timeFormData, work_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={timeFormData.description}
                        onChange={(e) => setTimeFormData({ ...timeFormData, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                        rows={3}
                        placeholder="Describe the work performed..."
                      />
                    </div>
                  </div>
                  
                  <div className="flex space-x-3 mt-4">
                    <button
                      type="submit"
                      disabled={timeLoading}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="w-4 h-4" />
                      <span>{timeLoading ? 'Saving...' : (editingTimeId ? 'Update' : 'Save')} Time Entry</span>
                    </button>
                    <button
                      type="button"
                      onClick={resetTimeForm}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Time Entries List */}
              {timeLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                  <p className="text-gray-500 mt-2">Loading time entries...</p>
                </div>
              ) : timeEntries.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">No time entries logged yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {timeEntries.map((entry) => (
                    <div key={entry.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <User className="w-4 h-4 text-gray-500" />
                            <h4 className="font-medium text-gray-900">{entry.user_name}</h4>
                            <span className="text-sm text-gray-500">{entry.user_email}</span>
                            {(() => {
                              const paymentInfo = getUserPaymentInfo(entry.ghl_user_id);
                              if (paymentInfo) {
                                return (
                                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                                    {paymentInfo.payment_type.charAt(0).toUpperCase() + paymentInfo.payment_type.slice(1)}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                          <p className="text-gray-700 mb-2">{entry.description}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span>{entry.hours} hours</span>
                            <span>{new Date(entry.work_date).toLocaleDateString()}</span>
                            {entry.hourly_rate && (
                              <span>{formatCurrency(entry.hourly_rate)}/hour</span>
                            )}
                            <span className="font-medium text-green-600">
                              Total: {formatCurrency(entry.total_cost)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => {
                              setTimeFormData({
                                user_id: entry.ghl_user_id,
                                user_name: entry.user_name,
                                user_email: entry.user_email,
                                hours: entry.hours.toString(),
                                hourly_rate: entry.hourly_rate?.toString() || '',
                                description: entry.description,
                                work_date: entry.work_date
                              });
                              setEditingTimeId(entry.id);
                              setShowTimeForm(true);
                            }}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                          >
                            <Edit2 className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => handleDeleteTimeEntry(entry.id)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          
          {activeTab === 'commissions' && (
            <>
              {/* Add Commission Button */}
              {!showCommissionForm && (
                <div className="mb-4">
                  <button
                    onClick={() => setShowCommissionForm(true)}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Assign Commission</span>
                  </button>
                  {commissions.length > 0 && (
                    <span className="ml-3 text-sm text-gray-600">
                      {commissions.length} team member{commissions.length !== 1 ? 's' : ''} assigned
                    </span>
                  )}
                </div>
              )}
              
              {/* Add/Edit Commission Form */}
              {showCommissionForm && (
                <form onSubmit={handleCommissionSubmit} className="bg-gray-50 rounded-lg p-4 mb-6">
                  {!editingCommissionId && (
                    <>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Team Members for Commission
                        </label>
                        <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                          {ghlUsers
                            .filter(user => {
                              const paymentInfo = getUserPaymentInfo(user.id);
                              return paymentInfo && (
                                paymentInfo.payment_type === 'commission_gross' ||
                                paymentInfo.payment_type === 'commission_profit' ||
                                paymentInfo.payment_type === 'hybrid'
                              );
                            })
                            .filter(user => !commissions.find(c => c.ghl_user_id === user.id))
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(user => {
                              const paymentInfo = getUserPaymentInfo(user.id);
                              const isSelected = selectedCommissionUsers.find(u => u.user_id === user.id);
                              
                              return (
                                <div key={user.id} className="p-2 hover:bg-gray-50 rounded">
                                  <label className="flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={!!isSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          // Add user with default values
                                          let defaultType = 'gross';
                                          let defaultPercentage = '';
                                          
                                          if (paymentInfo) {
                                            if (paymentInfo.payment_type === 'commission_gross') {
                                              defaultType = 'gross';
                                              defaultPercentage = paymentInfo.commission_percentage ? paymentInfo.commission_percentage.toString() : '10';
                                            } else if (paymentInfo.payment_type === 'commission_profit') {
                                              defaultType = 'profit';
                                              defaultPercentage = paymentInfo.commission_percentage ? paymentInfo.commission_percentage.toString() : '10';
                                            } else if (paymentInfo.payment_type === 'hybrid') {
                                              defaultType = 'profit';
                                              defaultPercentage = paymentInfo.commission_percentage ? paymentInfo.commission_percentage.toString() : '10';
                                            }
                                          }
                                          
                                          setSelectedCommissionUsers([...selectedCommissionUsers, {
                                            user_id: user.id,
                                            user_name: user.name,
                                            user_email: user.email,
                                            commission_type: defaultType,
                                            commission_percentage: defaultPercentage,
                                            notes: '',
                                            override_enabled: false
                                          }]);
                                        } else {
                                          // Remove user
                                          setSelectedCommissionUsers(selectedCommissionUsers.filter(u => u.user_id !== user.id));
                                        }
                                      }}
                                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                    />
                                    <div className="ml-3 flex-1">
                                      <p className="text-sm font-medium text-gray-900">{user.name}</p>
                                      <p className="text-xs text-gray-500">{getPaymentTypeDisplay(paymentInfo)}</p>
                                    </div>
                                  </label>
                                  {isSelected && (
                                    <div className="mt-2 ml-7">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updatedUsers = selectedCommissionUsers.map(u => 
                                            u.user_id === user.id 
                                              ? { ...u, override_enabled: !u.override_enabled }
                                              : u
                                          );
                                          setSelectedCommissionUsers(updatedUsers);
                                        }}
                                        className={`text-xs px-2 py-1 rounded transition-colors ${
                                          isSelected.override_enabled
                                            ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                            : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                        }`}
                                      >
                                        {isSelected.override_enabled ? '✓ Override Commission' : 'Override Commission'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                      
                      {selectedCommissionUsers.filter(u => u.override_enabled).length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-700">Commission Details</h4>
                          {selectedCommissionUsers
                            .filter(user => user.override_enabled)
                            .map((user, index) => {
                              const actualIndex = selectedCommissionUsers.findIndex(u => u.user_id === user.user_id);
                              return (
                                <div key={user.user_id} className="bg-white border border-gray-200 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <h5 className="text-sm font-medium text-gray-900">{user.user_name}</h5>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = selectedCommissionUsers.map(u => 
                                          u.user_id === user.user_id 
                                            ? { ...u, override_enabled: false }
                                            : u
                                        );
                                        setSelectedCommissionUsers(updated);
                                      }}
                                      className="text-gray-600 hover:text-gray-800"
                                      title="Remove override"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="block text-xs text-gray-600">Type</label>
                                      <select
                                        value={user.commission_type}
                                        onChange={(e) => {
                                          const updated = [...selectedCommissionUsers];
                                          updated[actualIndex].commission_type = e.target.value;
                                          setSelectedCommissionUsers(updated);
                                        }}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                                      >
                                        <option value="gross">% of Gross</option>
                                        <option value="profit">% of Profit</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-600">Percentage</label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        value={user.commission_percentage}
                                        onChange={(e) => {
                                          const updated = [...selectedCommissionUsers];
                                          updated[actualIndex].commission_percentage = e.target.value;
                                          setSelectedCommissionUsers(updated);
                                        }}
                                        placeholder="10"
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-600">Notes</label>
                                      <input
                                        type="text"
                                        value={user.notes}
                                        onChange={(e) => {
                                          const updated = [...selectedCommissionUsers];
                                          updated[actualIndex].notes = e.target.value;
                                          setSelectedCommissionUsers(updated);
                                        }}
                                        placeholder="Optional"
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </>
                  )}
                  
                  {editingCommissionId && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Team Member
                        </label>
                        <input
                          type="text"
                          value={commissionFormData.user_name}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-900"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Commission Type *
                        </label>
                        <select
                          required
                          value={commissionFormData.commission_type}
                          onChange={(e) => setCommissionFormData({ ...commissionFormData, commission_type: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                        >
                          <option value="gross">% of Gross Revenue</option>
                          <option value="profit">% of Net Profit</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Commission Percentage *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          required
                          value={commissionFormData.commission_percentage || ''}
                          onChange={(e) => setCommissionFormData({ 
                            ...commissionFormData, 
                            commission_percentage: e.target.value 
                          })}
                          placeholder="10"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notes
                        </label>
                        <input
                          type="text"
                          value={commissionFormData.notes}
                          onChange={(e) => setCommissionFormData({ ...commissionFormData, notes: e.target.value })}
                          placeholder="Optional notes"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-end space-x-3 mt-4">
                    <button
                      type="button"
                      onClick={resetCommissionForm}
                      className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={commissionLoading || (!editingCommissionId && selectedCommissionUsers.length === 0) || (!editingCommissionId && selectedCommissionUsers.every(u => !u.commission_percentage))}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {commissionLoading ? 'Saving...' : (editingCommissionId ? 'Update' : 'Assign')} Commission{!editingCommissionId && selectedCommissionUsers.length > 1 ? 's' : ''}
                    </button>
                  </div>
                </form>
              )}
              
              {/* Commission List */}
              {commissionLoading && !showCommissionForm ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading commissions...</p>
                </div>
              ) : commissions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No commission assignments yet</p>
                  <p className="text-xs mt-1">Click &quot;Assign Commission&quot; to add team members who will receive commission</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {commissions.map(commission => {
                    const grossAmount = opportunity.monetaryValue;
                    
                    // For profit-based commissions, calculate net BEFORE commissions
                    const materialExpenses = calculateMaterialExpenses();
                    const laborExpenses = calculateLaborCost();
                    const grossCommissions = commissions
                      .filter(c => c.commission_type === 'gross')
                      .reduce((sum, c) => sum + (opportunity.monetaryValue * c.commission_percentage / 100), 0);
                    const netBeforeCommissions = opportunity.monetaryValue - materialExpenses - laborExpenses - grossCommissions;
                    
                    const baseAmount = commission.commission_type === 'gross' ? grossAmount : netBeforeCommissions;
                    const commissionAmount = (baseAmount * commission.commission_percentage) / 100;
                    
                    return (
                      <div key={commission.id} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{commission.user_name}</h4>
                            <p className="text-sm text-gray-600">{commission.user_email}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {commission.commission_percentage}% of {commission.commission_type === 'gross' ? 'gross revenue' : 'net profit'}
                            </p>
                            {commission.notes && (
                              <p className="text-xs text-gray-500 mt-1 italic">{commission.notes}</p>
                            )}
                          </div>
                          <div className="flex items-start space-x-3">
                            <div className="text-right">
                              <p className="text-lg font-bold text-green-600">
                                {formatCurrency(commissionAmount)}
                              </p>
                              <p className="text-xs text-gray-500">Commission</p>
                            </div>
                            <div className="flex space-x-1">
                              <button
                                onClick={() => {
                                  setCommissionFormData({
                                    user_id: commission.ghl_user_id,
                                    user_name: commission.user_name,
                                    user_email: commission.user_email,
                                    commission_type: commission.commission_type,
                                    commission_percentage: commission.commission_percentage.toString(),
                                    notes: commission.notes || ''
                                  });
                                  setEditingCommissionId(commission.id);
                                  setShowCommissionForm(true);
                                }}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                              >
                                <Edit2 className="w-4 h-4 text-gray-500" />
                              </button>
                              <button
                                onClick={() => handleDeleteCommission(commission.id)}
                                className="p-1 hover:bg-gray-100 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Show calculation breakdown */}
                        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
                          <div className="flex justify-between">
                            <span>Base Amount:</span>
                            <span>{formatCurrency(baseAmount)}</span>
                          </div>
                          <div className="flex justify-between mt-1">
                            <span>Commission Rate:</span>
                            <span>{commission.commission_percentage}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}