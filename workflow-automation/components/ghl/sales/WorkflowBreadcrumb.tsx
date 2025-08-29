'use client';

import { ChevronRight, Building2, Calculator, FileText, DollarSign } from 'lucide-react';

interface WorkflowBreadcrumbProps {
  currentStep: 'opportunity' | 'estimate' | 'invoice';
  opportunityData?: any;
  estimateData?: any;
  invoiceData?: any;
}

export default function WorkflowBreadcrumb({ 
  currentStep, 
  opportunityData, 
  estimateData, 
  invoiceData 
}: WorkflowBreadcrumbProps) {
  const steps = [
    {
      id: 'opportunity',
      label: 'Opportunity',
      icon: Building2,
      data: opportunityData,
      completed: !!opportunityData,
    },
    {
      id: 'estimate',
      label: 'Estimate',
      icon: Calculator,
      data: estimateData,
      completed: !!estimateData,
    },
    {
      id: 'invoice',
      label: 'Invoice',
      icon: FileText,
      data: invoiceData,
      completed: !!invoiceData,
    }
  ];

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center space-x-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = step.completed && !isActive;
          
          return (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                  : isCompleted
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}>
                <Icon className={`w-4 h-4 ${
                  isActive 
                    ? 'text-blue-600' 
                    : isCompleted 
                    ? 'text-green-600' 
                    : 'text-gray-500'
                }`} />
                <span className="font-medium text-sm">{step.label}</span>
                {step.data && (
                  <div className="text-xs">
                    {step.data.name && <div className="truncate max-w-32">{step.data.name}</div>}
                    {step.data.amount && <div>${step.data.amount.toLocaleString()}</div>}
                    {step.data.monetaryValue && <div>${step.data.monetaryValue.toLocaleString()}</div>}
                  </div>
                )}
              </div>
              
              {index < steps.length - 1 && (
                <ChevronRight className="w-5 h-5 text-gray-400 mx-2" />
              )}
            </div>
          );
        })}
        
        {/* Progress Indicator */}
        <div className="ml-auto">
          <div className="text-xs text-gray-500">
            Step {steps.findIndex(s => s.id === currentStep) + 1} of {steps.length}
          </div>
        </div>
      </div>
      
      {/* Data Transfer Indicator */}
      {(estimateData?.converted_from_opportunity || invoiceData?.converted_from_estimate) && (
        <div className="mt-2 flex items-center space-x-2 text-xs text-green-600 bg-green-50 px-3 py-1 rounded">
          <DollarSign className="w-3 h-3" />
          <span>
            {invoiceData?.converted_from_estimate 
              ? 'All estimate data transferred to invoice'
              : 'All opportunity data transferred to estimate'
            }
          </span>
        </div>
      )}
    </div>
  );
}
