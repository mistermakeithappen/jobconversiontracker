'use client';

import { useCallback, useState, useMemo, useEffect } from 'react';
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  Edge,
  Node,
  NodeChange,
  EdgeChange,
  Connection,
  useReactFlow,
  ReactFlowProvider,
  MiniMap,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Webhook, Clock, Globe, Mail, Sparkles, Database, Code, GitBranch, Filter, Repeat, Search, Building2, Users, FileText, CreditCard, Calendar } from 'lucide-react';
import CustomNode from './CustomNode';

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    data: { 
      label: 'Start',
      icon: 'Play',
      description: 'Workflow starts here'
    },
    position: { x: 400, y: 100 },
    style: {
      background: '#f3f4f6',
      border: '2px solid #e5e7eb',
      borderRadius: '8px',
      padding: '10px',
      fontSize: '14px',
      fontWeight: '500',
    }
  },
];

const initialEdges: Edge[] = [];

// GoHighLevel specific options
const ghlTriggerOptions = [
  { value: 'contact_created', label: 'Contact Created', description: 'When a new contact is created' },
  { value: 'contact_updated', label: 'Contact Updated', description: 'When a contact is updated' },
  { value: 'opportunity_stage_changed', label: 'Opportunity Stage Changed', description: 'When opportunity moves to a new stage' },
  { value: 'form_submitted', label: 'Form Submitted', description: 'When a form is submitted' },
  { value: 'appointment_scheduled', label: 'Appointment Scheduled', description: 'When an appointment is scheduled' },
  { value: 'payment_received', label: 'Payment Received', description: 'When a payment is received' },
  { value: 'tag_added', label: 'Tag Added', description: 'When a tag is added to a contact' },
  { value: 'workflow_triggered', label: 'Workflow Triggered', description: 'When another workflow is triggered' },
];

const ghlActionOptions = [
  { value: 'create_contact', label: 'Create Contact', description: 'Create a new contact' },
  { value: 'update_contact', label: 'Update Contact', description: 'Update existing contact' },
  { value: 'add_tag', label: 'Add Tag', description: 'Add tag to contact' },
  { value: 'remove_tag', label: 'Remove Tag', description: 'Remove tag from contact' },
  { value: 'create_opportunity', label: 'Create Opportunity', description: 'Create new opportunity' },
  { value: 'update_opportunity', label: 'Update Opportunity', description: 'Update opportunity stage' },
  { value: 'send_sms', label: 'Send SMS', description: 'Send SMS to contact' },
  { value: 'send_email', label: 'Send Email', description: 'Send email to contact' },
  { value: 'create_task', label: 'Create Task', description: 'Create a task' },
  { value: 'book_appointment', label: 'Book Appointment', description: 'Book an appointment' },
];

const moduleCategories = [
  {
    name: 'Triggers',
    modules: [
      { 
        name: 'Webhook', 
        icon: Webhook, 
        color: 'bg-blue-100 text-blue-600', 
        description: 'Trigger on HTTP request', 
        moduleType: 'trigger',
        integration: 'webhook'
      },
      { name: 'Schedule', icon: Clock, color: 'bg-green-100 text-green-600', description: 'Run on a schedule', moduleType: 'trigger' },
      { 
        name: 'GoHighLevel Trigger', 
        icon: Building2, 
        color: 'bg-orange-100 text-orange-600', 
        description: 'Trigger from GHL events',
        moduleType: 'trigger',
        integration: 'gohighlevel',
        options: ghlTriggerOptions
      },
      { name: 'Form Submit', icon: FileText, color: 'bg-purple-100 text-purple-600', description: 'When form is submitted', moduleType: 'trigger' },
    ]
  },
  {
    name: 'Actions',
    modules: [
      { name: 'HTTP Request', icon: Globe, color: 'bg-orange-100 text-orange-600', description: 'Make an API call', moduleType: 'action' },
      { 
        name: 'GoHighLevel Action', 
        icon: Building2, 
        color: 'bg-orange-100 text-orange-600', 
        description: 'Perform GHL actions',
        moduleType: 'action',
        integration: 'GoHighLevel',
        options: ghlActionOptions
      },
      { name: 'Send Email', icon: Mail, color: 'bg-pink-100 text-pink-600', description: 'Send email notification', moduleType: 'action' },
      { name: 'AI Generate', icon: Sparkles, color: 'bg-indigo-100 text-indigo-600', description: 'Generate with AI', moduleType: 'action' },
      { name: 'Database Query', icon: Database, color: 'bg-cyan-100 text-cyan-600', description: 'Query database', moduleType: 'action' },
      { name: 'Transform Data', icon: Code, color: 'bg-amber-100 text-amber-600', description: 'Transform data', moduleType: 'action' },
    ]
  },
  {
    name: 'Logic',
    modules: [
      { name: 'Branch', icon: GitBranch, color: 'bg-red-100 text-red-600', description: 'Conditional logic', moduleType: 'action' },
      { name: 'Filter', icon: Filter, color: 'bg-emerald-100 text-emerald-600', description: 'Filter data', moduleType: 'action' },
      { name: 'Loop', icon: Repeat, color: 'bg-violet-100 text-violet-600', description: 'Iterate over items', moduleType: 'action' },
    ]
  }
];

interface FlowProps {
  initialData?: {
    nodes: Node[];
    edges: Edge[];
  };
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
}

function Flow({ initialData, onNodesChange: onNodesChangeCallback, onEdgesChange: onEdgesChangeCallback }: FlowProps) {
  const [nodes, setNodes] = useState<Node[]>(initialData?.nodes || initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialData?.edges || initialEdges);
  const [searchTerm, setSearchTerm] = useState('');
  const reactFlowInstance = useReactFlow();

  // Update nodes and edges when initialData changes
  useEffect(() => {
    if (initialData) {
      setNodes(initialData.nodes);
      setEdges(initialData.edges);
    }
  }, [initialData]);

  // Ensure at least one node exists
  useEffect(() => {
    if (nodes.length === 0 && !initialData) {
      setNodes(initialNodes);
    }
  }, []);

  // Notify parent component of changes
  useEffect(() => {
    if (onNodesChangeCallback) {
      onNodesChangeCallback(nodes);
    }
  }, [nodes, onNodesChangeCallback]);

  useEffect(() => {
    if (onEdgesChangeCallback) {
      onEdgesChangeCallback(edges);
    }
  }, [edges, onEdgesChangeCallback]);

  // Define custom node types
  const nodeTypes = useMemo(() => ({
    custom: CustomNode,
  }), []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({
      ...params,
      style: { stroke: '#94a3b8', strokeWidth: 2 },
      animated: true,
    }, eds)),
    []
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const moduleData = event.dataTransfer.getData('application/reactflow');
      if (!moduleData) return;

      const module = JSON.parse(moduleData);

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `${Date.now()}`,
        type: module.options ? 'custom' : 'default',
        position,
        data: { 
          label: module.name,
          description: module.description,
          iconName: module.name, // Pass the name instead of the component
          color: module.color,
          integration: module.integration,
          moduleType: module.moduleType,
          options: module.options,
          selectedOption: ''
        },
        style: module.options ? undefined : {
          background: '#ffffff',
          border: '2px solid #e5e7eb',
          borderRadius: '8px',
          padding: '12px',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        }
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance]
  );

  const filteredModules = moduleCategories.map(category => ({
    ...category,
    modules: category.modules.filter(module =>
      module.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.modules.length > 0);

  return (
    <div className="flex h-full">
      <div className="w-72 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3">Modules</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search modules..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="p-4 space-y-6">
          {filteredModules.map((category) => (
            <div key={category.name}>
              <h4 className="font-medium text-sm text-gray-700 mb-3">{category.name}</h4>
              <div className="space-y-2">
                {category.modules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <div
                      key={module.name}
                      className="bg-white border border-gray-200 rounded-lg p-3 cursor-move hover:shadow-md transition-all duration-200 hover:border-blue-300"
                      onDragStart={(event) => {
                        event.dataTransfer.setData('application/reactflow', JSON.stringify(module));
                      }}
                      draggable
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${module.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900">{module.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{module.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-gray-50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          fitView
          defaultEdgeOptions={{
            style: { stroke: '#94a3b8', strokeWidth: 2 },
            animated: true,
          }}
        >
          <Background color="#e5e7eb" gap={16} />
          <Controls className="bg-white border border-gray-200 rounded-lg shadow-sm" />
          <MiniMap 
            className="bg-white border border-gray-200 rounded-lg shadow-sm"
            maskColor="rgba(229, 231, 235, 0.7)"
            nodeColor="#e5e7eb"
          />
          <Panel position="top-center" className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm text-gray-600">Drag modules from the left panel to build your workflow</p>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

interface WorkflowBuilderProps {
  initialData?: {
    nodes: Node[];
    edges: Edge[];
  };
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
}

export default function WorkflowBuilder({ initialData, onNodesChange, onEdgesChange }: WorkflowBuilderProps) {
  return (
    <ReactFlowProvider>
      <Flow 
        initialData={initialData} 
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
      />
    </ReactFlowProvider>
  );
}