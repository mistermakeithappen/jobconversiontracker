import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Target, Plus, X, Check, Edit2 } from 'lucide-react';
import { textareaStyles, inputStyles, labelStyles, displayTextStyles } from './common-styles';

export default function MilestoneNode({ data, selected }: NodeProps) {
  const node = data.node;
  const [isEditing, setIsEditing] = useState(false);
  const [editingOutcome, setEditingOutcome] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    goal_description: node?.goal_description || '',
    extra_instructions: node?.config?.extra_instructions || '',
    possible_outcomes: node?.possible_outcomes || []
  });
  const [newOutcome, setNewOutcome] = useState('');

  const handleSave = useCallback(() => {
    if (data.onNodeUpdate) {
      data.onNodeUpdate(node.node_id, {
        goal_description: formData.goal_description,
        config: {
          ...node.config,
          extra_instructions: formData.extra_instructions
        },
        possible_outcomes: formData.possible_outcomes
      });
    }
    setIsEditing(false);
  }, [data, node, formData]);

  const handleAddOutcome = useCallback(() => {
    if (newOutcome.trim()) {
      const updatedOutcomes = [...formData.possible_outcomes, newOutcome.trim()];
      setFormData({ ...formData, possible_outcomes: updatedOutcomes });
      setNewOutcome('');
      
      // Auto-save when adding outcome
      if (data.onNodeUpdate) {
        data.onNodeUpdate(node.node_id, {
          possible_outcomes: updatedOutcomes
        });
      }
    }
  }, [newOutcome, formData, data, node]);

  const handleRemoveOutcome = useCallback((index: number) => {
    const updatedOutcomes = formData.possible_outcomes.filter((_, i) => i !== index);
    setFormData({ ...formData, possible_outcomes: updatedOutcomes });
    
    // Auto-save when removing outcome
    if (data.onNodeUpdate) {
      data.onNodeUpdate(node.node_id, {
        possible_outcomes: updatedOutcomes
      });
    }
  }, [formData, data, node]);

  const handleUpdateOutcome = useCallback((index: number, value: string) => {
    const updatedOutcomes = [...formData.possible_outcomes];
    updatedOutcomes[index] = value;
    setFormData({ ...formData, possible_outcomes: updatedOutcomes });
  }, [formData]);

  const handleSaveOutcome = useCallback((index: number) => {
    setEditingOutcome(null);
    if (data.onNodeUpdate) {
      data.onNodeUpdate(node.node_id, {
        possible_outcomes: formData.possible_outcomes
      });
    }
  }, [formData, data, node]);

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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-600" />
          <div className="text-sm font-semibold text-purple-800">Milestone</div>
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
      
      {/* Goal Input */}
      <div className="mb-2">
        <label className={labelStyles}>Goal:</label>
        {isEditing ? (
          <textarea
            value={formData.goal_description}
            onChange={(e) => setFormData({ ...formData, goal_description: e.target.value })}
            onBlur={handleSave}
            className={textareaStyles.full}
            rows={2}
            placeholder="What should the bot achieve at this point?"
          />
        ) : (
          <div className={`${displayTextStyles.value} mt-1`}>
            {formData.goal_description || <span className={displayTextStyles.placeholder}>Click edit to set goal</span>}
          </div>
        )}
      </div>

      {/* Extra Instructions */}
      {(isEditing || formData.extra_instructions) && (
        <div className="mb-2">
          <label className={labelStyles}>Extra Instructions:</label>
          {isEditing ? (
            <textarea
              value={formData.extra_instructions}
              onChange={(e) => setFormData({ ...formData, extra_instructions: e.target.value })}
              onBlur={handleSave}
              className={textareaStyles.full}
              rows={2}
              placeholder="Additional context or instructions for the AI"
            />
          ) : (
            <div className="text-xs text-gray-600 mt-1 italic">
              {formData.extra_instructions}
            </div>
          )}
        </div>
      )}

      {/* Outcomes */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <label className={labelStyles}>Outcome Paths:</label>
          {isEditing && (
            <button
              onClick={() => setNewOutcome('New Outcome')}
              className="p-1 bg-purple-200 hover:bg-purple-300 rounded transition-colors"
            >
              <Plus className="w-3 h-3 text-purple-700" />
            </button>
          )}
        </div>
        
        <div className="space-y-1">
          {formData.possible_outcomes.map((outcome, index) => (
            <div key={index} className="relative group">
              {/* Outcome Handle */}
              <Handle
                type="source"
                position={Position.Right}
                id={`outcome_${index}`}
                style={{ top: '50%' }}
                className="w-3 h-3 bg-purple-500 border-2 border-white"
              />
              
              {editingOutcome === index ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={outcome}
                    onChange={(e) => handleUpdateOutcome(index, e.target.value)}
                    onBlur={() => handleSaveOutcome(index)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSaveOutcome(index)}
                    className={`flex-1 ${inputStyles.full}`}
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveOutcome(index)}
                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 pr-6">
                  <div 
                    onClick={() => isEditing && setEditingOutcome(index)}
                    className={`flex-1 px-2 py-1 text-xs bg-purple-50 border border-purple-200 rounded ${
                      isEditing ? 'cursor-text hover:bg-purple-100' : ''
                    }`}
                  >
                    {outcome}
                  </div>
                  {isEditing && (
                    <button
                      onClick={() => handleRemoveOutcome(index)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          
          {/* Add new outcome input */}
          {isEditing && newOutcome && (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newOutcome}
                onChange={(e) => setNewOutcome(e.target.value)}
                onBlur={() => newOutcome.trim() && handleAddOutcome()}
                onKeyPress={(e) => e.key === 'Enter' && handleAddOutcome()}
                className={`flex-1 ${inputStyles.full}`}
                placeholder="Enter outcome path name"
                autoFocus
              />
              <button
                onClick={handleAddOutcome}
                className="p-1 text-green-600 hover:bg-green-50 rounded"
              >
                <Check className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Default Handle */}
        <div className="mt-2 relative">
          <Handle
            type="source"
            position={Position.Right}
            id="default"
            style={{ top: '50%' }}
            className="w-3 h-3 bg-gray-400 border-2 border-white"
          />
          <div className="text-xs text-gray-500 italic pr-6">
            No match / Stay on node
          </div>
        </div>
      </div>

      {/* Save button when editing */}
      {isEditing && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}