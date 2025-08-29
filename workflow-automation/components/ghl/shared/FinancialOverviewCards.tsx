import React from 'react';

interface FinancialOverviewCardsProps {
  opportunityValue: number;
  laborCost: number;
  materialExpenses: number;
  totalCommissions: number;
  totalCosts: number;
  netProfit: number;
  cashCollected?: number;
  className?: string;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

export default function FinancialOverviewCards({
  opportunityValue,
  laborCost,
  materialExpenses,
  totalCommissions,
  totalCosts,
  netProfit,
  cashCollected,
  className = ""
}: FinancialOverviewCardsProps) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-6 gap-3 ${className}`}>
      <div className="bg-blue-50 rounded-lg p-3">
        <p className="text-xs text-blue-600">Opportunity Value</p>
        <p className="text-lg font-bold text-blue-900">{formatCurrency(opportunityValue)}</p>
      </div>
      
      {cashCollected !== undefined && cashCollected > 0 && (
        <div className="bg-emerald-50 rounded-lg p-3">
          <p className="text-xs text-emerald-600">Cash Collected</p>
          <p className="text-lg font-bold text-emerald-900">{formatCurrency(cashCollected)}</p>
        </div>
      )}
      
      <div className="bg-orange-50 rounded-lg p-3">
        <p className="text-xs text-orange-600">Labor Cost</p>
        <p className="text-lg font-bold text-orange-900">{formatCurrency(laborCost)}</p>
      </div>
      
      <div className="bg-purple-50 rounded-lg p-3">
        <p className="text-xs text-purple-600">Material Expenses</p>
        <p className="text-lg font-bold text-purple-900">{formatCurrency(materialExpenses)}</p>
      </div>
      
      <div className="bg-yellow-50 rounded-lg p-3">
        <p className="text-xs text-yellow-600">Total Commissions</p>
        <p className="text-lg font-bold text-yellow-900">{formatCurrency(totalCommissions)}</p>
      </div>
      
      <div className="bg-red-50 rounded-lg p-3">
        <p className="text-xs text-red-600">Total Costs</p>
        <p className="text-lg font-bold text-red-900">{formatCurrency(totalCosts)}</p>
      </div>
      
      <div className={`${netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'} rounded-lg p-3`}>
        <p className={`text-xs ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Net Profit</p>
        <p className={`text-lg font-bold ${netProfit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
          {formatCurrency(netProfit)}
        </p>
      </div>
    </div>
  );
}


