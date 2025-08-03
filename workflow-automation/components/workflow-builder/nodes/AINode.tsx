import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Brain, Edit2, Check, Settings } from 'lucide-react';
import { inputStyles, textareaStyles, labelStyles, displayTextStyles, selectStyles, checkboxStyles } from './common-styles';

export default function AINode({ data, selected }: NodeProps) {
  const node = data.node;
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: node?.title || 'AI Assistant',
    system_prompt: node?.config?.system_prompt || 'You are a helpful AI assistant.',
    model: node?.config?.model || 'gpt-4',
    temperature: node?.config?.temperature || 0.7,
    max_tokens: node?.config?.max_tokens || 500,
    include_history: node?.config?.include_history !== false,
    store_in_variable: node?.config?.store_in_variable || ''
  });

  const handleSave = useCallback(() => {
    if (data.onNodeUpdate) {
      data.onNodeUpdate(node.node_id, {
        title: formData.title,
        config: {
          ...node.config,
          system_prompt: formData.system_prompt,
          model: formData.model,
          temperature: parseFloat(formData.temperature.toString()),
          max_tokens: parseInt(formData.max_tokens.toString()),
          include_history: formData.include_history,
          store_in_variable: formData.store_in_variable
        }
      });
    }
    setIsEditing(false);
  }, [data, node, formData]);

  return (
    <div 
      className={`
        px-4 py-3 rounded-lg border-2 min-w-[300px] max-w-[400px]
        ${selected 
          ? 'border-purple-500 shadow-lg shadow-purple-500/20' 
          : 'border-purple-400 shadow-md'
        }
        bg-gradient-to-r from-purple-50 to-purple-100
        hover:shadow-lg transition-all duration-200
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-purple-500 border-2 border-white"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-600" />
          <div className="text-sm font-semibold text-purple-800">AI Assistant</div>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1 hover:bg-purple-200 rounded transition-colors"
        >
          {isEditing ? (
            <Check className="w-4 h-4 text-purple-600" />
          ) : (
            <Edit2 className="w-4 h-4 text-purple-600" />
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

      {/* System Prompt */}
      <div className="mb-2">
        <label className={labelStyles}>System Prompt:</label>
        {isEditing ? (
          <textarea
            value={formData.system_prompt}
            onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
            onBlur={handleSave}
            className={`${textareaStyles.full} mt-1`}
            rows={3}
            placeholder="Define the AI's behavior and context..."
          />
        ) : (
          <div className="text-xs text-gray-600 mt-1 line-clamp-2">
            {formData.system_prompt}
          </div>
        )}
      </div>

      {/* Model Selection */}
      <div className="mb-2">
        <label className={labelStyles}>Model:</label>
        {isEditing ? (
          <select
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            onBlur={handleSave}
            className={`${selectStyles.full} mt-1`}
          >
            <option value="gpt-4">GPT-4</option>
            <option value="gpt-4-turbo-preview">GPT-4 Turbo</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          </select>
        ) : (
          <div className="text-xs text-gray-700 font-medium mt-1">
            {formData.model}
          </div>
        )}
      </div>

      {/* Advanced Settings (only show when editing) */}
      {isEditing && (
        <>
          {/* Temperature */}
          <div className="mb-2">
            <label className={labelStyles}>Temperature ({formData.temperature}):</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
              onBlur={handleSave}
              className="w-full mt-1"
            />
          </div>

          {/* Max Tokens */}
          <div className="mb-2">
            <label className={labelStyles}>Max Tokens:</label>
            <input
              type="number"
              value={formData.max_tokens}
              onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) || 500 })}
              onBlur={handleSave}
              className={`${inputStyles.full} mt-1`}
              min="1"
              max="4000"
            />
          </div>

          {/* Include History */}
          <div className="mb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.include_history}
                onChange={(e) => setFormData({ ...formData, include_history: e.target.checked })}
                onBlur={handleSave}
                className={checkboxStyles}
              />
              <span className="text-xs text-gray-700">Include conversation history</span>
            </label>
          </div>

          {/* Store in Variable */}
          <div className="mb-2">
            <label className={labelStyles}>Store Response in Variable:</label>
            <input
              type="text"
              value={formData.store_in_variable}
              onChange={(e) => setFormData({ ...formData, store_in_variable: e.target.value })}
              onBlur={handleSave}
              className={`${inputStyles.full} mt-1`}
              placeholder="Variable name (optional)"
            />
          </div>
        </>
      )}

      {/* Save button when editing */}
      {isEditing && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
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
        className="w-3 h-3 bg-purple-500 border-2 border-white"
      />
    </div>
  );
}