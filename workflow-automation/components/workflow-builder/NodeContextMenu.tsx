import React from 'react';
import { Edit2, Trash2, X } from 'lucide-react';

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function NodeContextMenu({ 
  x, 
  y, 
  nodeId, 
  onEdit, 
  onDelete, 
  onClose 
}: NodeContextMenuProps) {
  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.node-context-menu')) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      className="node-context-menu fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        minWidth: '160px'
      }}
    >
      <button
        onClick={() => {
          onEdit();
          onClose();
        }}
        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <Edit2 className="w-4 h-4" />
        <span>Edit Node</span>
      </button>
      
      <div className="border-t border-gray-100 my-1"></div>
      
      <button
        onClick={() => {
          if (window.confirm('Are you sure you want to delete this node? This action cannot be undone.')) {
            onDelete();
            onClose();
          }
        }}
        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        <span>Delete Node</span>
      </button>
    </div>
  );
}