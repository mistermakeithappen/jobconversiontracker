'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Play, Settings, Building2, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { authenticatedFetch } from '@/lib/utils/api-fetch';

// Dynamically import React Flow to avoid SSR issues
const BotWorkflowBuilder = dynamic(
  () => import('@/components/workflow-builder/BotWorkflowBuilder'),
  { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full"><p>Loading workflow editor...</p></div>
  }
);

interface Bot {
  id: string;
  name: string;
  description: string;
  avatar_url?: string;
  is_active: boolean;
}

interface Workflow {
  id: string;
  bot_id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface WorkflowNode {
  id: string;
  workflow_id: string;
  node_id: string;
  node_type: string;
  title: string;
  description?: string;
  goal_description?: string;
  possible_outcomes?: string[];
  calendar_ids?: string[];
  position_x: number;
  position_y: number;
  config: any;
  actions: any[];
  created_at: string;
  updated_at: string;
}

interface WorkflowConnection {
  id?: string;
  workflow_id: string;
  source_node_id: string;
  target_node_id: string;
  connection_type: 'standard' | 'conditional' | 'goal_achieved' | 'goal_not_achieved';
  condition?: any;
  label?: string;
  created_at: string;
}

export default function WorkflowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const botId = params.botId as string;
  
  const [bot, setBot] = useState<Bot | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [connections, setConnections] = useState<WorkflowConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasBusinessContext, setHasBusinessContext] = useState<boolean | null>(null);

  useEffect(() => {
    fetchBotAndWorkflow();
    checkBusinessContext();
  }, [botId]);

  const fetchBotAndWorkflow = async () => {
    try {
      setIsLoading(true);
      
      // Fetch bot details
      const botResponse = await authenticatedFetch(`/api/bots?botId=${botId}`);
      if (!botResponse.ok) {
        console.error('Failed to fetch bot:', botResponse.status, botResponse.statusText);
        return;
      }
      const botData = await botResponse.json();
      setBot(botData);

      // Fetch workflow for this bot
      const workflowResponse = await authenticatedFetch(`/api/bots/${botId}/workflows`);
      if (workflowResponse.ok) {
        const workflowData = await workflowResponse.json();
        if (workflowData.length > 0) {
          const wf = workflowData[0]; // Get the first workflow
          setWorkflow(wf);
          
          // Fetch nodes and connections
          const [nodesRes, connectionsRes] = await Promise.all([
            authenticatedFetch(`/api/bots/workflows/${wf.id}/nodes`),
            authenticatedFetch(`/api/bots/workflows/${wf.id}/connections`)
          ]);
          
          if (nodesRes.ok) {
            const nodesData = await nodesRes.json();
            setNodes(nodesData);
          }
          
          if (connectionsRes.ok) {
            const connectionsData = await connectionsRes.json();
            setConnections(connectionsData);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkBusinessContext = async () => {
    try {
      const response = await authenticatedFetch(`/api/bots/${botId}/context`);
      if (response.ok) {
        const data = await response.json();
        setHasBusinessContext(!!data.context);
      }
    } catch (error) {
      console.error('Error checking business context:', error);
    }
  };

  const handleSave = async (updatedNodes: WorkflowNode[], updatedConnections: WorkflowConnection[]) => {
    try {
      // Create workflow if it doesn't exist
      let workflowId = workflow?.id;
      if (!workflowId) {
        const createResponse = await fetch(`/api/bots/${botId}/workflows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${bot?.name || 'Bot'} Workflow`,
            description: 'Main workflow',
            is_active: true
          })
        });
        
        if (!createResponse.ok) throw new Error('Failed to create workflow');
        const newWorkflow = await createResponse.json();
        workflowId = newWorkflow.id;
        setWorkflow(newWorkflow);
      }
      
      // Save nodes
      await fetch(`/api/bots/workflows/${workflowId}/nodes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedNodes)
      });
      
      // Save connections
      await fetch(`/api/bots/workflows/${workflowId}/connections`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConnections)
      });
      
      // Don't show alert for autosave - the UI will show the save status
    } catch (error) {
      console.error('Error saving workflow:', error);
      throw error; // Let the workflow builder handle the error
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading workflow editor...</p>
        </div>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Bot not found</p>
          <Link href="/chatbot" className="text-purple-600 hover:text-purple-700">
            Back to Bot Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/chatbot"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-800">
                {bot.name} - Workflow Editor
              </h1>
              <p className="text-sm text-gray-600">
                Design your bot's conversation flow
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Link
              href={`/chatbot/${botId}/test`}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Test Bot
            </Link>
            <Link
              href={`/chatbot/${botId}/settings`}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
          </div>
        </div>
      </div>

      {/* Business Context Banner */}
      {hasBusinessContext === false && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  No business context configured for this bot
                </p>
                <p className="text-xs text-yellow-700">
                  Set up your bot's business context to provide accurate, on-brand responses.
                </p>
              </div>
            </div>
            <Link
              href={`/chatbot/${botId}/settings`}
              className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition-colors flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Configure in Settings
            </Link>
          </div>
        </div>
      )}

      {/* Workflow Builder */}
      <div className="flex-1 relative">
        <BotWorkflowBuilder
          workflowId={workflow?.id}
          botId={botId}
          initialNodes={nodes}
          initialConnections={connections}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}