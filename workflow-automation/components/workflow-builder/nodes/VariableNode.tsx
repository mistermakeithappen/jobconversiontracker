import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Variable, Edit2, Check } from 'lucide-react';
import { inputStyles, textareaStyles, labelStyles, displayTextStyles } from './common-styles';

export default function VariableNode({ data, selected }: NodeProps) {
  const node = data.node;
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: node?.title || 'Set Variable',
    variable_name: node?.config?.variable_name || '',
    value: node?.config?.value || ''
  });

  const handleSave = useCallback(() => {
    if (data.onNodeUpdate) {
      data.onNodeUpdate(node.node_id, {
        title: formData.title,
        config: {
          ...node.config,
          variable_name: formData.variable_name,
          value: formData.value
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
          ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' 
          : 'border-indigo-400 shadow-md'
        }
        bg-gradient-to-r from-indigo-50 to-indigo-100
        hover:shadow-lg transition-all duration-200
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-indigo-500 border-2 border-white"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Variable className="w-4 h-4 text-indigo-600" />
          <div className="text-sm font-semibold text-indigo-800">Variable</div>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1 hover:bg-indigo-200 rounded transition-colors"
        >
          {isEditing ? (
            <Check className="w-4 h-4 text-indigo-600" />
          ) : (
            <Edit2 className="w-4 h-4 text-indigo-600" />
          )}
        </button>
      </div>
      
      {/* Title */}
      <div className="mb-3">
        {isEditing ? (
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            onBlur={handleSave}
            onKeyPress={(e) => e.key === 'Enter' && handleSave()}
            className={inputStyles.full}
            placeholder="Node title"
          />
        ) : (
          <div className={displayTextStyles.value}>
            {formData.title}
          </div>
        )}
      </div>

      {/* Variable Name */}
      <div className="mb-2">
        <label className={labelStyles}>Variable Name:</label>
        {isEditing ? (
          <input
            type="text"
            value={formData.variable_name}
            onChange={(e) => setFormData({ ...formData, variable_name: e.target.value })}
            onBlur={handleSave}
            className={`${inputStyles.full} mt-1`}
            placeholder="e.g., customer_name"
          />
        ) : (
          <div className={`mt-1 ${formData.variable_name ? 'font-mono text-sm text-indigo-700 bg-white px-2 py-1 rounded border border-indigo-200' : 'text-xs text-gray-500 italic'}`}>
            {formData.variable_name || 'No variable set'}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="mb-2">
        <label className={labelStyles}>Value:</label>
        {isEditing ? (
          <textarea
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            onBlur={handleSave}
            className={`${textareaStyles.full} mt-1`}
            rows={2}
            placeholder="Static value or use {{variable}} for dynamic values"
          />
        ) : (
          <div className={`text-xs text-gray-600 mt-1 ${formData.value ? '' : 'italic'}`}>
            {formData.value || 'No value set'}
          </div>
        )}
      </div>

      {/* Variable syntax hint */}
      {isEditing && (
        <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
          <div className="font-semibold mb-1">Variable Syntax:</div>
          <div>• Use {`{{variable_name}}`} to reference other variables</div>
          <div>• Example: Hello {`{{customer_name}}`}!</div>
        </div>
      )}

      {/* Save button when editing */}
      {isEditing && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      )}

      {/* Standard handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="standard"
        className="w-3 h-3 bg-indigo-500 border-2 border-white"
      />
    </div>
  );
}