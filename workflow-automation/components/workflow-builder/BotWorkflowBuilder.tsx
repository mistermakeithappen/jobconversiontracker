'use client';

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Controls,
  Background,
  MiniMap,
  Panel,
  Connection,
  MarkerType,
  NodeChange,
  EdgeChange,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import '@/styles/workflow.css';

// Import custom nodes
import StartNode from './nodes/StartNode';
import MilestoneNode from './nodes/MilestoneNode';
import AppointmentNode from './nodes/AppointmentNode';
import MessageNode from './nodes/MessageNode';
import ConditionNode from './nodes/ConditionNode';
import ActionNode from './nodes/ActionNode';
import EndNode from './nodes/EndNode';
import AINode from './nodes/AINode';
import VariableNode from './nodes/VariableNode';

// Import other components
import NodePalette from './NodePalette';
import NodeConfigPanel from './NodeConfigPanel';
import WorkflowTestWidget from './WorkflowTestWidget';
import NodeContextMenu from './NodeContextMenu';
import { WorkflowNode, WorkflowConnection, NodeType } from '@/types/bot-system';

// Define nodeTypes outside component to prevent React Flow warnings
const nodeTypes = {
  start: StartNode,
  milestone: MilestoneNode,
  book_appointment: AppointmentNode,
  appointment: AppointmentNode, // alias for compatibility
  message: MessageNode,
  condition: ConditionNode,
  action: ActionNode,
  ghl_action: ActionNode, // alias for GHL actions
  end: EndNode,
  ai: AINode,
  variable: VariableNode,
} as const;

interface BotWorkflowBuilderProps {
  workflowId?: string;
  botId?: string;
  initialNodes?: WorkflowNode[];
  initialConnections?: WorkflowConnection[];
  onSave?: (nodes: WorkflowNode[], connections: WorkflowConnection[]) => void;
  onChange?: (nodes: WorkflowNode[], connections: WorkflowConnection[]) => void;
}

function BotWorkflowBuilder({
  workflowId,
  botId,
  initialNodes = [],
  initialConnections = [],
  onSave,
  onChange,
}: BotWorkflowBuilderProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showSavedMessage, setShowSavedMessage] = useState(false);
  const [showTestWidget, setShowTestWidget] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Convert WorkflowNode to ReactFlow Node
  const convertToFlowNodes = useCallback((workflowNodes: WorkflowNode[], onNodeUpdate?: (nodeId: string, updates: Partial<WorkflowNode>) => void): Node[] => {
    return workflowNodes.map(node => ({
      id: node.node_id,
      type: node.node_type,
      position: { x: node.position_x, y: node.position_y },
      data: { 
        node,
        label: node.title,
        onNodeUpdate,
        userId: node.user_id || botId?.split('-')[0], // Extract user ID from bot ID or use the node's user_id
        hasGoalAchievedPath: initialConnections.some(
          c => c.source_node_id === node.node_id && c.connection_type === 'goal_achieved'
        ),
        hasGoalNotAchievedPath: initialConnections.some(
          c => c.source_node_id === node.node_id && c.connection_type === 'goal_not_achieved'
        ),
        conditions: initialConnections
          .filter(c => c.source_node_id === node.node_id && c.connection_type === 'conditional')
          .map(c => c.condition),
      },
      className: node.node_id === activeNodeId ? 'active-node' : '',
      style: node.node_id === activeNodeId ? {
        boxShadow: '0 0 0 3px #8b5cf6, 0 0 20px rgba(139, 92, 246, 0.5)',
        transition: 'box-shadow 0.3s ease'
      } : {},
    }));
  }, [initialConnections, botId, activeNodeId]);

  // Convert WorkflowConnection to ReactFlow Edge
  const convertToFlowEdges = useCallback((connections: WorkflowConnection[]): Edge[] => {
    return connections.map((conn, index) => ({
      id: conn.id || `edge_${index}`,
      source: conn.source_node_id,
      target: conn.target_node_id,
      sourceHandle: conn.connection_type === 'standard' ? undefined : conn.connection_type,
      label: conn.label,
      type: 'smoothstep',
      animated: conn.connection_type === 'goal_achieved',
      style: getEdgeStyle(conn.connection_type),
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
      },
      data: { connection: conn },
    }));
  }, []);

  // Initialize with empty nodes first
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(convertToFlowEdges(initialConnections));

  // Define refs first to avoid initialization issues
  const triggerAutosaveRef = useRef<() => void>();
  const handleNodeUpdateWithAutosaveRef = useRef<(nodeId: string, updates: Partial<WorkflowNode>) => void>();

  // Handle node updates from inline editing
  const handleNodeUpdate = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const updatedNodeData = {
            ...node.data.node,
            ...updates,
            updated_at: new Date().toISOString(),
          };
          return {
            ...node,
            data: {
              ...node.data,
              node: updatedNodeData,
            },
          };
        }
        return node;
      })
    );
  }, [setNodes]);


  // Handle connection creation
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;

      // Determine connection type based on source handle
      let connectionType: WorkflowConnection['connection_type'] = 'standard';
      if (params.sourceHandle) {
        if (params.sourceHandle === 'goal_achieved') connectionType = 'goal_achieved';
        else if (params.sourceHandle === 'goal_not_achieved') connectionType = 'goal_not_achieved';
        else if (params.sourceHandle.startsWith('condition_')) connectionType = 'conditional';
      }

      const newEdge: Edge = {
        ...params,
        id: `edge_${Date.now()}`,
        type: 'smoothstep',
        animated: connectionType === 'goal_achieved',
        style: getEdgeStyle(connectionType),
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
        },
        data: {
          connection: {
            workflow_id: workflowId || '',
            source_node_id: params.source,
            target_node_id: params.target,
            connection_type: connectionType,
          },
        },
      };

      setEdges((eds) => addEdge(newEdge, eds));
      triggerAutosaveRef.current?.();
    },
    [workflowId, setEdges]
  );

  // Handle node selection (removed panel opening)
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Do nothing - nodes will handle their own inline editing
  }, []);

  // Handle right-click on node
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    event.stopPropagation();
    
    // Don't show context menu for certain node types
    if (node.type === 'start' || node.type === 'end') {
      return;
    }
    
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      nodeId: node.id,
    });
  }, []);

  // Handle node deletion
  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    triggerAutosaveRef.current?.();
  }, [setNodes, setEdges]);

  // Handle node edit
  const handleEditNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      setSelectedNode(node.data.node);
      setShowConfigPanel(true);
    }
  }, [nodes]);

  // Handle node execution (for test widget)
  const handleNodeExecution = useCallback((nodeId: string | null) => {
    setActiveNodeId(nodeId);
    
    // Auto-scroll to active node
    if (nodeId && reactFlowInstance) {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        reactFlowInstance.setCenter(node.position.x + 150, node.position.y + 50, {
          duration: 800,
          zoom: 1.5
        });
      }
    }
  }, [reactFlowInstance, nodes]);

  // Handle node drag
  const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
    // Update node position in data
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === node.id) {
          return {
            ...n,
            data: {
              ...n.data,
              node: {
                ...n.data.node,
                position_x: node.position.x,
                position_y: node.position.y,
              },
            },
          };
        }
        return n;
      })
    );
    triggerAutosaveRef.current?.();
  }, [setNodes]);

  // Handle drop from palette
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('nodeType') as NodeType;
      if (!type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: WorkflowNode = {
        id: `node_${Date.now()}`,
        workflow_id: workflowId || '',
        node_id: `node_${Date.now()}`,
        node_type: type,
        title: getDefaultNodeTitle(type),
        position_x: position.x,
        position_y: position.y,
        config: {},
        actions: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const flowNode: Node = {
        id: newNode.node_id,
        type: newNode.node_type,
        position,
        data: { 
          node: newNode, 
          label: newNode.title,
          onNodeUpdate: handleNodeUpdateWithAutosaveRef.current,
          userId: botId?.split('-')[0] // Extract user ID from bot ID
        },
      };

      setNodes((nds) => nds.concat(flowNode));
      triggerAutosaveRef.current?.();
    },
    [reactFlowInstance, workflowId, setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Update selected node
  const updateSelectedNode = useCallback((updates: Partial<WorkflowNode>) => {
    if (!selectedNode) return;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.node_id) {
          const updatedNode = {
            ...node.data.node,
            ...updates,
            updated_at: new Date().toISOString(),
          };
          return {
            ...node,
            data: {
              ...node.data,
              node: updatedNode,
              label: updates.title || node.data.label,
            },
          };
        }
        return node;
      })
    );

    setSelectedNode((prev) => prev ? { ...prev, ...updates } : null);
  }, [selectedNode, setNodes]);

  // Convert flow state back to workflow format
  const getWorkflowData = useCallback((): { nodes: WorkflowNode[], connections: WorkflowConnection[] } => {
    const workflowNodes = nodes.map(node => ({
      ...node.data.node,
      position_x: node.position.x,
      position_y: node.position.y,
    }));

    const workflowConnections = edges.map(edge => edge.data?.connection || {
      id: edge.id,
      workflow_id: workflowId || '',
      source_node_id: edge.source,
      target_node_id: edge.target,
      connection_type: 'standard' as const,
      label: edge.label,
      created_at: new Date().toISOString(),
    });

    return { nodes: workflowNodes, connections: workflowConnections };
  }, [nodes, edges, workflowId]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (isSaving || !onSave) return;
    
    try {
      setIsSaving(true);
      const { nodes: workflowNodes, connections } = getWorkflowData();
      await onSave(workflowNodes, connections);
      setLastSaved(new Date());
      
      // Show saved message temporarily
      setShowSavedMessage(true);
      if (savedMessageTimeoutRef.current) {
        clearTimeout(savedMessageTimeoutRef.current);
      }
      savedMessageTimeoutRef.current = setTimeout(() => {
        setShowSavedMessage(false);
      }, 2000); // Show for 2 seconds
    } catch (error) {
      console.error('Failed to save workflow:', error);
      // Don't show alert for autosave failures
    } finally {
      setIsSaving(false);
    }
  }, [getWorkflowData, onSave, isSaving]);

  // Autosave functionality
  const triggerAutosave = useCallback(() => {
    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set a new timeout for autosave (1 second delay)
    saveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 1000);
  }, [handleSave]);

  // Handle node updates from inline editing with autosave
  const handleNodeUpdateWithAutosave = useCallback((nodeId: string, updates: Partial<WorkflowNode>) => {
    handleNodeUpdate(nodeId, updates);
    triggerAutosaveRef.current?.();
  }, [handleNodeUpdate]);

  // Store functions in refs to use in other callbacks
  useEffect(() => {
    triggerAutosaveRef.current = triggerAutosave;
    handleNodeUpdateWithAutosaveRef.current = handleNodeUpdateWithAutosave;
  }, [triggerAutosave, handleNodeUpdateWithAutosave]);

  // Initialize nodes with autosave-enabled update handler
  useEffect(() => {
    if (handleNodeUpdateWithAutosaveRef.current && initialNodes.length > 0) {
      const nodesWithUpdate = convertToFlowNodes(initialNodes, handleNodeUpdateWithAutosaveRef.current);
      setNodes(nodesWithUpdate);
      
      // Fit view after nodes are loaded
      if (reactFlowInstance) {
        setTimeout(() => {
          reactFlowInstance.fitView({ padding: 0.2, duration: 800 });
        }, 100);
      }
    }
  }, [initialNodes, convertToFlowNodes, setNodes, reactFlowInstance]); // Use stable dependencies

  // Notify parent of changes
  React.useEffect(() => {
    const { nodes: workflowNodes, connections } = getWorkflowData();
    onChange?.(workflowNodes, connections);
  }, [nodes, edges, getWorkflowData, onChange]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (savedMessageTimeoutRef.current) {
        clearTimeout(savedMessageTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full h-full flex">
      <NodePalette />
      
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onNodeDragStop={onNodeDragStop}
          onInit={(instance) => {
            setReactFlowInstance(instance);
            // Fit view after initialization
            setTimeout(() => {
              instance.fitView({ padding: 0.2, duration: 800 });
            }, 50);
          }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onPaneClick={() => setContextMenu(null)}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{
            padding: 0.2,
            includeHiddenNodes: false,
            minZoom: 0.5,
            maxZoom: 2
          }}
          className="bg-gray-50"
        >
          <Controls />
          <MiniMap />
          <Background variant="dots" gap={12} size={1} />
          
          <Panel position="top-right">
            <div className="flex gap-2">
              {/* Test button */}
              <button
                onClick={() => setShowTestWidget(!showTestWidget)}
                className={`
                  px-4 py-2.5 rounded-lg font-medium transition-all duration-200
                  ${showTestWidget 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-white text-purple-600 border border-purple-600 hover:bg-purple-50'
                  }
                `}
              >
                {showTestWidget ? 'Hide Test' : 'Test Workflow'}
              </button>
              
              {/* Save button with integrated status */}
              <button
                onClick={handleSave}
                disabled={isSaving || showSavedMessage}
                className={`
                  relative px-5 py-2.5 rounded-lg font-medium transition-all duration-200 min-w-[120px]
                  ${isSaving 
                    ? 'bg-blue-500 text-white cursor-wait' 
                    : showSavedMessage
                    ? 'bg-green-600 text-white cursor-default'
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                  }
                `}
              >
                {/* Button content with transitions */}
                <span className={`flex items-center justify-center gap-2 transition-opacity duration-200 ${isSaving || showSavedMessage ? 'opacity-0' : ''}`}>
                  Save Now
                </span>
                
                {/* Saving animation overlay */}
                {isSaving && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </div>
                  </div>
                )}
                
                {/* Saved message overlay */}
                {showSavedMessage && !isSaving && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Saved</span>
                    </div>
                  </div>
                )}
              </button>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Test Widget */}
      {showTestWidget && (
        <WorkflowTestWidget
          workflowId={workflowId || ''}
          botId={botId}
          nodes={nodes.map(n => n.data.node)}
          edges={edges.map(e => e.data?.connection || {
            id: e.id,
            workflow_id: workflowId || '',
            source_node_id: e.source,
            target_node_id: e.target,
            connection_type: 'standard' as const,
          })}
          onClose={() => setShowTestWidget(false)}
          onNodeExecution={handleNodeExecution}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          onEdit={() => handleEditNode(contextMenu.nodeId)}
          onDelete={() => handleDeleteNode(contextMenu.nodeId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

// Helper functions
function getEdgeStyle(connectionType: WorkflowConnection['connection_type']) {
  switch (connectionType) {
    case 'goal_achieved':
      return { stroke: '#10b981', strokeWidth: 2 };
    case 'goal_not_achieved':
      return { stroke: '#ef4444', strokeWidth: 2 };
    case 'conditional':
      return { stroke: '#f59e0b', strokeWidth: 2 };
    default:
      return { stroke: '#6b7280', strokeWidth: 2 };
  }
}

function getDefaultNodeTitle(type: NodeType): string {
  const titles: Record<NodeType, string> = {
    start: 'Start',
    milestone: 'Goal Achievement',
    book_appointment: 'Book Appointment',
    message: 'Send Message',
    condition: 'Check Condition',
    action: 'Execute Action',
    end: 'End Conversation',
  };
  return titles[type] || 'New Node';
}
export default React.memo(BotWorkflowBuilder);
