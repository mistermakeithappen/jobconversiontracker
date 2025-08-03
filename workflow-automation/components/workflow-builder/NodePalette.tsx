import React from 'react';
import { Play, Target, Calendar, MessageSquare, GitBranch, Zap, CheckCircle, Variable } from 'lucide-react';
import { NodeType } from '@/types/bot-system';

interface NodePaletteItem {
  type: NodeType;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const paletteItems: NodePaletteItem[] = [
  {
    type: 'start',
    label: 'Start',
    icon: <Play className="w-5 h-5" />,
    description: 'Entry point of the workflow',
    color: 'from-green-400 to-green-600',
  },
  {
    type: 'milestone',
    label: 'Milestone',
    icon: <Target className="w-5 h-5" />,
    description: 'Goal-based AI conversation',
    color: 'from-pink-400 to-pink-600',
  },
  {
    type: 'book_appointment',
    label: 'Book Appointment',
    icon: <Calendar className="w-5 h-5" />,
    description: 'AI-powered appointment booking',
    color: 'from-blue-400 to-blue-600',
  },
  {
    type: 'message',
    label: 'Message',
    icon: <MessageSquare className="w-5 h-5" />,
    description: 'AI-delivered message',
    color: 'from-cyan-400 to-cyan-600',
  },
  {
    type: 'condition',
    label: 'Condition',
    icon: <GitBranch className="w-5 h-5" />,
    description: 'Branch based on conditions',
    color: 'from-orange-400 to-orange-600',
  },
  {
    type: 'variable' as NodeType,
    label: 'Variable',
    icon: <Variable className="w-5 h-5" />,
    description: 'Set or update variables',
    color: 'from-indigo-400 to-indigo-600',
  },
  {
    type: 'action',
    label: 'Action',
    icon: <Zap className="w-5 h-5" />,
    description: 'Perform actions (tags, webhooks)',
    color: 'from-amber-400 to-amber-600',
  },
  {
    type: 'end',
    label: 'End',
    icon: <CheckCircle className="w-5 h-5" />,
    description: 'End the conversation',
    color: 'from-gray-400 to-gray-600',
  },
];

export default function NodePalette() {
  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('nodeType', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Node Palette</h3>
      <div className="space-y-3">
        {paletteItems.map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => onDragStart(e, item.type)}
            className="cursor-move"
          >
            <div className="group relative bg-white border-2 border-gray-200 rounded-lg p-3 hover:border-gray-400 hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-gradient-to-r ${item.color} text-white`}>
                  {item.icon}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{item.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
                </div>
              </div>
              
              {/* Drag hint */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg">
                  Drag to canvas
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-3 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Tips</h4>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• Drag nodes to the canvas</li>
          <li>• Connect nodes by dragging handles</li>
          <li>• Click nodes to configure them</li>
          <li>• Use milestone nodes for AI decisions</li>
        </ul>
      </div>
    </div>
  );
}