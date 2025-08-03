import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { CheckCircle, Edit2, Check } from 'lucide-react';
import { textareaStyles, checkboxStyles, labelStyles, displayTextStyles } from './common-styles';

export default function EndNode({ data, selected }: NodeProps) {
  const node = data.node;
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    message: node?.config?.message || '',
    save_conversation: node?.config?.save_conversation ?? true
  });

  const handleSave = useCallback(() => {
    if (data.onNodeUpdate) {
      data.onNodeUpdate(node.node_id, {
        config: {
          ...node.config,
          message: formData.message,
          save_conversation: formData.save_conversation
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
          ? 'border-gray-600 shadow-lg shadow-gray-500/20' 
          : 'border-gray-500 shadow-md'
        }
        bg-gradient-to-r from-gray-100 to-gray-200
        hover:shadow-lg transition-all duration-200
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-gray-500 border-2 border-white"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-gray-600" />
          <div className="text-sm font-semibold text-gray-800">End</div>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1 hover:bg-gray-300 rounded transition-colors"
        >
          {isEditing ? (
            <Check className="w-4 h-4 text-gray-600" />
          ) : (
            <Edit2 className="w-4 h-4 text-gray-600" />
          )}
        </button>
      </div>
      
      {/* Ending Message */}
      <div className="mb-2">
        <label className={labelStyles}>Ending Message:</label>
        {isEditing ? (
          <textarea
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            onBlur={handleSave}
            onKeyPress={(e) => e.key === 'Enter' && e.ctrlKey && handleSave()}
            className={`${textareaStyles.full} mt-1`}
            rows={3}
            placeholder="Final message to the user..."
          />
        ) : (
          <div className={`${displayTextStyles.value} mt-1 whitespace-pre-wrap`}>
            {formData.message || <span className={displayTextStyles.placeholder}>Click edit to set ending message</span>}
          </div>
        )}
      </div>

      {/* Save Conversation Option */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`save-conversation-${node?.node_id}`}
          checked={formData.save_conversation}
          onChange={(e) => setFormData({ ...formData, save_conversation: e.target.checked })}
          onBlur={handleSave}
          disabled={!isEditing}
          className="w-3 h-3 text-gray-600 border-gray-300 rounded focus:ring-gray-500 disabled:opacity-50"
        />
        <label 
          htmlFor={`save-conversation-${node?.node_id}`} 
          className={`text-xs ${isEditing ? 'text-gray-700' : 'text-gray-600'}`}
        >
          Save conversation history
        </label>
      </div>

      {/* Save button when editing */}
      {isEditing && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}