'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, Save, Play, Settings, Sparkles, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Dynamic import to avoid SSR issues with React Flow
const WorkflowBuilder = dynamic(
  () => import('@/components/workflow-builder/WorkflowBuilder'),
  { ssr: false }
);

export default function NewWorkflowPage() {
  const [workflowName, setWorkflowName] = useState('');
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [workflowData, setWorkflowData] = useState<any>(null);
  const [currentNodes, setCurrentNodes] = useState<any[]>([]);
  const [currentEdges, setCurrentEdges] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isWorkflowReady, setIsWorkflowReady] = useState(false);
  const router = useRouter();
  
  // Track when workflow is ready
  useEffect(() => {
    if (currentNodes.length > 0 && !isWorkflowReady) {
      setIsWorkflowReady(true);
    }
  }, [currentNodes, isWorkflowReady]);
  
  // Callback handlers that properly update state
  const handleNodesChange = useCallback((nodes: any[]) => {
    setCurrentNodes(nodes);
  }, []);
  
  const handleEdgesChange = useCallback((edges: any[]) => {
    setCurrentEdges(edges);
  }, []);

  const handleSaveWorkflow = useCallback(async () => {
    if (!workflowName.trim()) {
      alert('Please enter a workflow name');
      return;
    }

    if (currentNodes.length === 0) {
      alert('Please add at least one module to your workflow');
      return;
    }

    setIsSaving(true);
    try {

      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workflowName,
          description: `Created with AI: ${aiPrompt || 'Manual creation'}`,
          definition: {
            nodes: currentNodes,
            edges: currentEdges,
            variables: []
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        alert(`Failed to save workflow: ${errorData.error || 'Unknown error'}`);
        return;
      }

      const data = await response.json();
      router.push('/workflows');
    } catch (error) {
      console.error('Error saving workflow:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        alert('Network error: Unable to connect to the server. Please check your connection and try again.');
      } else {
        alert(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setIsSaving(false);
    }
  }, [workflowName, currentNodes, currentEdges, aiPrompt, router]);

  const handleAIGenerate = useCallback(async () => {
    if (!aiPrompt.trim()) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt })
      });

      const data = await response.json();
      
      if (data.success) {
        setWorkflowData(data.workflow);
        setShowAIDialog(false);
        setAIPrompt('');
        
        // Generate a name from the prompt
        const generatedName = aiPrompt.slice(0, 50) + (aiPrompt.length > 50 ? '...' : '');
        setWorkflowName(generatedName);
      } else {
        alert('Failed to generate workflow. Please try again.');
      }
    } catch (error) {
      console.error('Error generating workflow:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [aiPrompt]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-full mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Link 
              href="/workflows" 
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex items-center space-x-3">
              <input
                type="text"
                placeholder="Untitled Workflow"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                className="text-lg font-medium px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[250px] text-gray-900 placeholder-gray-500"
              />
              <span className="text-sm text-gray-500">Draft</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowAIDialog(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate with AI</span>
            </button>
            
            <button className="inline-flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Play className="w-4 h-4" />
              <span>Test</span>
            </button>
            
            <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            
            <div className="h-6 w-px bg-gray-300"></div>
            
            <button 
              onClick={handleSaveWorkflow}
              disabled={isSaving}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Workflow</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <WorkflowBuilder 
          initialData={workflowData} 
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
        />
      </div>

      {/* AI Generation Dialog */}
      {showAIDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Generate Workflow with AI</h3>
            <p className="text-sm text-gray-600 mb-4">
              Describe what you want your workflow to do in plain English.
            </p>
            
            <div className="space-y-3 mb-4">
              <div className="text-sm text-gray-500">Try examples like:</div>
              <div className="space-y-2">
                <button
                  onClick={() => setAIPrompt("When a contact is created in GoHighLevel, send them a welcome email")}
                  className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  "When a contact is created in GoHighLevel, send them a welcome email"
                </button>
                <button
                  onClick={() => setAIPrompt("Every day at 9am, check for new opportunities and create tasks")}
                  className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  "Every day at 9am, check for new opportunities and create tasks"
                </button>
              </div>
            </div>

            <textarea
              value={aiPrompt}
              onChange={(e) => setAIPrompt(e.target.value)}
              placeholder="Describe what you want your workflow to do..."
              className="w-full p-3 border border-gray-300 rounded-lg h-32 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
              disabled={isGenerating}
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button 
                onClick={() => {
                  setShowAIDialog(false);
                  setAIPrompt('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isGenerating}
              >
                Cancel
              </button>
              <button 
                onClick={handleAIGenerate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isGenerating || !aiPrompt.trim()}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}