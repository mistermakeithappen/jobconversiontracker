import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Play, Edit2, Check } from 'lucide-react';
import { textareaStyles, checkboxStyles, labelStyles, displayTextStyles } from './common-styles';

export default function StartNode({ data, selected }: NodeProps) {
  const node = data.node;
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    welcome_message: node?.config?.welcome_message || '',
    skip_welcome: node?.config?.skip_welcome || false
  });

  const handleSave = useCallback(() => {
    if (data.onNodeUpdate) {
      data.onNodeUpdate(node.node_id, {
        config: {
          ...node.config,
          welcome_message: formData.welcome_message,
          skip_welcome: formData.skip_welcome
        }
      });
    }
    setIsEditing(false);
  }, [data, node, formData]);

  return (
    <div 
      className={`
        px-4 py-3 rounded-lg border-2 min-w-[280px] max-w-[350px]
        ${selected 
          ? 'border-green-500 shadow-lg shadow-green-500/20' 
          : 'border-green-400 shadow-md'
        }
        bg-gradient-to-r from-green-50 to-green-100
        hover:shadow-lg transition-all duration-200
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-green-600" />
          <div className="text-sm font-semibold text-green-800">Start</div>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1 hover:bg-green-200 rounded transition-colors"
        >
          {isEditing ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Edit2 className="w-4 h-4 text-green-600" />
          )}
        </button>
      </div>
      
      {/* Skip Welcome Option */}
      <div className="mb-2 flex items-center gap-2">
        <input
          type="checkbox"
          id={`skip-welcome-${node?.node_id}`}
          checked={formData.skip_welcome}
          onChange={(e) => setFormData({ ...formData, skip_welcome: e.target.checked })}
          onBlur={handleSave}
          disabled={!isEditing}
          className={`${checkboxStyles} disabled:opacity-50`}
        />
        <label 
          htmlFor={`skip-welcome-${node?.node_id}`} 
          className={`text-xs ${isEditing ? 'text-gray-700' : 'text-gray-600'}`}
        >
          Skip welcome message (immediate response)
        </label>
      </div>

      {/* Welcome Message */}
      {!formData.skip_welcome && (
        <div>
          <label className={labelStyles}>Welcome Message:</label>
          {isEditing ? (
            <textarea
              value={formData.welcome_message}
              onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
              onBlur={handleSave}
              onKeyPress={(e) => e.key === 'Enter' && e.ctrlKey && handleSave()}
              className={`${textareaStyles.full} mt-1`}
              rows={3}
              placeholder="Enter the welcome message..."
            />
          ) : (
            <div className={`${displayTextStyles.value} mt-1 whitespace-pre-wrap`}>
              {formData.welcome_message || <span className={displayTextStyles.placeholder}>Click edit to set welcome message</span>}
            </div>
          )}
        </div>
      )}
      
      {/* Visual indicator when skipping */}
      {formData.skip_welcome && !isEditing && (
        <div className="text-xs text-gray-500 italic">
          → Direct to first node
        </div>
      )}

      {/* Save button when editing */}
      {isEditing && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />
    </div>
  );
}