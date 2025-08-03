import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { MessageSquare, Edit2, Check } from 'lucide-react';
import { inputStyles, textareaStyles, labelStyles, displayTextStyles } from './common-styles';

export default function MessageNode({ data, selected }: NodeProps) {
  const node = data.node;
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: node?.title || 'Send Message',
    message: node?.config?.message || ''
  });

  const handleSave = useCallback(() => {
    if (data.onNodeUpdate) {
      data.onNodeUpdate(node.node_id, {
        title: formData.title,
        config: {
          ...node.config,
          message: formData.message
        }
      });
    }
    setIsEditing(false);
  }, [data, node, formData]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  }, [handleSave]);
  
  return (
    <div 
      className={`
        px-4 py-3 rounded-lg border-2 min-w-[280px] max-w-[350px]
        ${selected 
          ? 'border-cyan-500 shadow-lg shadow-cyan-500/20' 
          : 'border-cyan-400 shadow-md'
        }
        bg-gradient-to-r from-cyan-50 to-cyan-100
        hover:shadow-lg transition-all duration-200
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-cyan-500 border-2 border-white"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cyan-600" />
          <div className="text-sm font-semibold text-cyan-800">Message</div>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1 hover:bg-cyan-200 rounded transition-colors"
        >
          {isEditing ? (
            <Check className="w-4 h-4 text-cyan-600" />
          ) : (
            <Edit2 className="w-4 h-4 text-cyan-600" />
          )}
        </button>
      </div>
      
      {/* Title */}
      <div className="mb-2">
        {isEditing ? (
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            onBlur={handleSave}
            onKeyPress={(e) => e.key === 'Enter' && handleSave()}
            className={inputStyles.full}
            placeholder="Message title"
          />
        ) : (
          <div className={displayTextStyles.value}>
            {formData.title}
          </div>
        )}
      </div>
      
      {/* Message Content */}
      <div>
        <label className={labelStyles}>Message:</label>
        {isEditing ? (
          <textarea
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            onBlur={handleSave}
            onKeyPress={handleKeyPress}
            className={`${textareaStyles.full} mt-1`}
            rows={3}
            placeholder="Enter the message to send..."
          />
        ) : (
          <div className={`${displayTextStyles.value} mt-1 whitespace-pre-wrap`}>
            {formData.message || <span className={displayTextStyles.placeholder}>Click edit to set message</span>}
          </div>
        )}
      </div>

      {/* Save button when editing */}
      {isEditing && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-cyan-500 border-2 border-white"
      />
    </div>
  );
}