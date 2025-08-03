'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Receipt, TrendingUp, TrendingDown, MoreVertical, Plus, FileText, ChevronDown, Building2, Camera, User } from 'lucide-react';
import { ReceiptModal } from './receipt-modal';
import { getSupabaseClient } from '@/lib/auth/client';

interface Opportunity {
  id: string;
  name: string;
  contactName: string;
  pipelineName: string;
  stageName: string;
  status: string;
  monetaryValue: number;
  totalExpenses: number;
  materialExpenses: number;
  laborExpenses: number;
  totalCommissions: number;
  grossCommissions: number;
  profitCommissions: number;
  netProfit: number;
  profitMargin: number;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  assignedToName?: string;
}

interface Pipeline {
  id: string;
  name: string;
  stages: Array<{
    id: string;
    name: string;
    position: number;
  }>;
}

interface OpportunitiesPipelineViewProps {
  opportunities: Opportunity[];
  pipelines: Pipeline[];
  integrationId: string;
  onRefresh: () => void;
  openOpportunityId?: string | null;
  onOpportunityOpened?: () => void;
}

export function OpportunitiesPipelineView({ 
  opportunities, 
  pipelines, 
  integrationId,
  onRefresh,
  openOpportunityId,
  onOpportunityOpened
}: OpportunitiesPipelineViewProps) {
  // Get unique pipelines from opportunities if pipelines array is empty
  const availablePipelines = pipelines.length > 0 
    ? pipelines 
    : Array.from(new Set(opportunities.map(o => ({ 
        id: o.pipelineName, 
        name: o.pipelineName 
      }))));
  
  // Default to first pipeline instead of 'all'
  const [selectedPipeline, setSelectedPipeline] = useState<string>('');
  
  // Update selected pipeline when pipelines data loads
  useEffect(() => {
    console.log('Pipeline data updated:', {
      pipelines: pipelines.length,
      opportunities: opportunities.length,
      availablePipelines: availablePipelines.length,
      selectedPipeline
    });
    
    if (availablePipelines.length > 0 && !selectedPipeline) {
      const firstPipeline = availablePipelines[0]?.id || availablePipelines[0]?.name || '';
      console.log('Setting selected pipeline to:', firstPipeline);
      setSelectedPipeline(firstPipeline);
    }
  }, [availablePipelines, selectedPipeline, pipelines.length, opportunities.length]);

  // Handle opening opportunity from URL parameter
  useEffect(() => {
    if (openOpportunityId && opportunities.length > 0) {
      const opportunity = opportunities.find(opp => opp.id === openOpportunityId);
      if (opportunity) {
        setSelectedOpportunity(opportunity);
        setShowReceiptModal(true);
        if (onOpportunityOpened) {
          onOpportunityOpened();
        }
      }
    }
  }, [openOpportunityId, opportunities, onOpportunityOpened]);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  // Filter opportunities by pipeline
  const filteredOpportunities = opportunities.filter(opp => 
    opp.pipelineName === selectedPipeline || 
    (pipelines.find(p => p.id === selectedPipeline)?.name === opp.pipelineName)
  );
  
  console.log('Filtering opportunities:', {
    totalOpportunities: opportunities.length,
    selectedPipeline,
    filteredCount: filteredOpportunities.length,
    firstOpportunity: opportunities[0]
  });

  // Group opportunities by stage
  const opportunitiesByStage = filteredOpportunities.reduce((acc, opp) => {
    if (!acc[opp.stageName]) {
      acc[opp.stageName] = [];
    }
    acc[opp.stageName].push(opp);
    return acc;
  }, {} as Record<string, Opportunity[]>);

  // Get stages in correct order from pipeline configuration
  const getOrderedStages = () => {
    const currentPipeline = pipelines.find(p => 
      p.id === selectedPipeline || p.name === selectedPipeline
    );
    
    if (currentPipeline && currentPipeline.stages && currentPipeline.stages.length > 0) {
      // Use pipeline stages sorted by position
      const orderedStages = [...currentPipeline.stages]
        .sort((a, b) => {
          // Handle cases where position might be undefined or null
          const posA = typeof a.position === 'number' ? a.position : 999;
          const posB = typeof b.position === 'number' ? b.position : 999;
          return posA - posB;
        })
        .map(stage => stage.name);
      
      console.log('Pipeline stages ordered by position:', {
        pipelineId: currentPipeline.id,
        pipelineName: currentPipeline.name,
        stages: currentPipeline.stages.map(s => ({ name: s.name, position: s.position })),
        orderedStages
      });
      
      // Filter to only include stages that have opportunities
      const stagesWithOpportunities = orderedStages.filter(stageName => 
        opportunitiesByStage[stageName] && opportunitiesByStage[stageName].length > 0
      );
      
      // Add any stages with opportunities that weren't in the pipeline config
      const extraStages = Object.keys(opportunitiesByStage).filter(stageName => 
        !orderedStages.includes(stageName) && opportunitiesByStage[stageName].length > 0
      );
      
      const finalStages = [...stagesWithOpportunities, ...extraStages];
      console.log('Final ordered stages with opportunities:', finalStages);
      return finalStages;
    }
    
    // Fallback to stages from opportunities (no guaranteed order)
    const stageNames = Object.keys(opportunitiesByStage);
    console.log('Fallback to opportunity stage names (no pipeline config):', stageNames);
    return stageNames;
  };

  const orderedStages = getOrderedStages();

  // Calculate totals
  const totals = filteredOpportunities.reduce((acc, opp) => ({
    revenue: acc.revenue + opp.monetaryValue,
    expenses: acc.expenses + opp.totalExpenses,
    materialExpenses: acc.materialExpenses + (opp.materialExpenses || 0),
    laborExpenses: acc.laborExpenses + (opp.laborExpenses || 0),
    totalCommissions: acc.totalCommissions + (opp.totalCommissions || 0),
    grossCommissions: acc.grossCommissions + (opp.grossCommissions || 0),
    profitCommissions: acc.profitCommissions + (opp.profitCommissions || 0),
    profit: acc.profit + opp.netProfit,
    count: acc.count + 1
  }), { 
    revenue: 0, 
    expenses: 0, 
    materialExpenses: 0, 
    laborExpenses: 0, 
    totalCommissions: 0,
    grossCommissions: 0,
    profitCommissions: 0,
    profit: 0, 
    count: 0 
  });

  const avgProfitMargin = totals.count > 0 
    ? (totals.profit / totals.revenue * 100).toFixed(2) 
    : '0';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getProfitMarginColor = (margin: number) => {
    if (margin >= 30) return 'text-green-600';
    if (margin >= 15) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleAIReceiptUpload = async (opportunityId: string, file: File) => {
    setUploadingFor(opportunityId);
    
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const formData = new FormData();
      formData.append('image', file);
      formData.append('opportunity_id', opportunityId);
      formData.append('integration_id', integrationId);
      
      const response = await fetch('/api/receipts/ai-process', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: formData
      });
      
      if (response.ok) {
        // Refresh the opportunities data to show new receipt
        onRefresh();
      } else {
        alert('Failed to process receipt with AI');
      }
    } catch (error) {
      console.error('Error uploading receipt:', error);
      alert('Error uploading receipt');
    } finally {
      setUploadingFor(null);
    }
  };

  const triggerFileUpload = (opportunityId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleAIReceiptUpload(opportunityId, file);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.revenue)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Expenses</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.expenses)}</p>
              <div className="mt-1 space-y-1">
                <p className="text-xs text-gray-500">Materials: {formatCurrency(totals.materialExpenses)}</p>
                <p className="text-xs text-gray-500">Labor: {formatCurrency(totals.laborExpenses)}</p>
                <p className="text-xs text-gray-500">Commissions: {formatCurrency(totals.totalCommissions)}</p>
              </div>
            </div>
            <Receipt className="w-8 h-8 text-red-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Net Profit</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.profit)}</p>
            </div>
            {totals.profit >= 0 ? (
              <TrendingUp className="w-8 h-8 text-green-500" />
            ) : (
              <TrendingDown className="w-8 h-8 text-red-500" />
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Profit Margin</p>
              <p className={`text-2xl font-bold ${getProfitMarginColor(parseFloat(avgProfitMargin))}`}>
                {avgProfitMargin}%
              </p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Pipeline Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
                <Building2 className="w-4 h-4 text-blue-600" />
              </div>
              <label className="text-sm font-semibold text-gray-800">Pipeline</label>
            </div>
            <div className="relative">
              <select
                value={selectedPipeline}
                onChange={(e) => setSelectedPipeline(e.target.value)}
                className="appearance-none bg-white border-2 border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm font-medium text-gray-900 hover:border-blue-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 cursor-pointer min-w-56 shadow-sm hover:shadow-md"
              >
                {availablePipelines.map(pipeline => (
                  <option key={pipeline.id || pipeline.name} value={pipeline.id || pipeline.name}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-6">
            <div className="flex items-center space-x-2 bg-blue-50 px-3 py-2 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-blue-700">
                {filteredOpportunities.length} opportunities
              </span>
            </div>
            <div className="flex items-center space-x-2 bg-green-50 px-3 py-2 rounded-lg">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                {formatCurrency(totals.revenue)}
              </span>
            </div>
          </div>
        </div>
        
        {/* Mobile Stats */}
        <div className="md:hidden mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center space-x-2 bg-blue-50 px-3 py-2 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium text-blue-700">
                {filteredOpportunities.length} opps
              </span>
            </div>
            <div className="flex items-center space-x-2 bg-green-50 px-3 py-2 rounded-lg">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                {formatCurrency(totals.revenue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline View */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="inline-flex space-x-4 p-4 min-w-full">
            {orderedStages.map((stageName) => {
              const stageOpportunities = opportunitiesByStage[stageName] || [];
              return (
              <div key={stageName} className="flex-shrink-0 w-80">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">{stageName}</h3>
                    <span className="text-sm text-gray-500">{stageOpportunities.length}</span>
                  </div>
                  
                  <div className="space-y-3">
                    {stageOpportunities.map((opportunity) => (
                      <div
                        key={opportunity.id}
                        className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => {
                          setSelectedOpportunity(opportunity);
                          setShowReceiptModal(true);
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 line-clamp-1">{opportunity.name}</h4>
                            <p className="text-sm text-gray-600">{opportunity.contactName}</p>
                            {opportunity.assignedToName && (
                              <div className="flex items-center mt-1 text-xs text-gray-500">
                                <User className="w-3 h-3 mr-1" />
                                <span>{opportunity.assignedToName}</span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Add dropdown menu here if needed
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Value:</span>
                            <span className="font-medium text-yellow-600">{formatCurrency(opportunity.monetaryValue)}</span>
                          </div>
                          
                          {opportunity.materialExpenses > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Materials:</span>
                              <span className="text-red-600">-{formatCurrency(opportunity.materialExpenses)}</span>
                            </div>
                          )}
                          
                          {opportunity.laborExpenses > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Labor:</span>
                              <span className="text-red-600">-{formatCurrency(opportunity.laborExpenses)}</span>
                            </div>
                          )}
                          
                          {opportunity.totalCommissions > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Commissions:</span>
                              <span className="text-red-600">-{formatCurrency(opportunity.totalCommissions)}</span>
                            </div>
                          )}
                          
                          {opportunity.totalExpenses > 0 && (
                            <div className="flex justify-between text-sm font-medium">
                              <span className="text-gray-700">Total Expenses:</span>
                              <span className="text-red-600">-{formatCurrency(opportunity.totalExpenses)}</span>
                            </div>
                          )}
                          
                          <div className="border-t pt-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Net Profit:</span>
                              <span className={`font-medium ${opportunity.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(opportunity.netProfit)}
                              </span>
                            </div>
                            
                            <div className="flex justify-between text-sm mt-1">
                              <span className="text-gray-600">Margin:</span>
                              <span className="font-medium text-blue-600">
                                {opportunity.profitMargin.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {opportunity.totalExpenses > 0 && (
                          <div className="mt-3 flex items-center text-xs text-gray-500">
                            <Receipt className="w-3 h-3 mr-1" />
                            Receipts logged
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceiptModal && selectedOpportunity && (
        <ReceiptModal
          opportunity={selectedOpportunity}
          integrationId={integrationId}
          onClose={() => {
            setShowReceiptModal(false);
            setSelectedOpportunity(null);
          }}
          onUpdate={onRefresh}
        />
      )}
    </div>
  );
}