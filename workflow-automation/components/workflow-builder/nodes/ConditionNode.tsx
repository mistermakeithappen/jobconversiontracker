import React, { useState, useCallback, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { GitBranch, Edit2, Check, Plus, X, Loader2 } from 'lucide-react';
import { inputStyles, selectStyles, labelStyles, displayTextStyles } from './common-styles';

export default function ConditionNode({ data, selected }: NodeProps) {
  const node = data.node;
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: node?.title || 'Check Condition',
    condition_type: node?.config?.condition_type || 'field_equals',
    field_name: node?.config?.field_name || '',
    operator: node?.config?.operator || 'equals',
    value: node?.config?.value || '',
    conditions: node?.config?.conditions || []
  });
  const [newCondition, setNewCondition] = useState({ label: '', value: '' });
  const [customFields, setCustomFields] = useState<Array<{id: string; name: string; fieldKey: string; dataType: string}>>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loadingGHLData, setLoadingGHLData] = useState(false);

  // Load GHL data when editing starts
  useEffect(() => {
    if (isEditing) {
      loadGHLData();
    }
  }, [isEditing]);

  const loadGHLData = async () => {
    setLoadingGHLData(true);
    try {
      const [fieldsResponse, tagsResponse] = await Promise.all([
        fetch('/api/ghl/custom-fields'),
        fetch('/api/ghl/tags')
      ]);
      
      if (fieldsResponse.ok) {
        const fieldsData = await fieldsResponse.json();
        setCustomFields(fieldsData.customFields || []);
      }
      
      if (tagsResponse.ok) {
        const tagsData = await tagsResponse.json();
        setAvailableTags(tagsData.tags || []);
      }
    } catch (error) {
      console.error('Failed to load GHL data:', error);
    } finally {
      setLoadingGHLData(false);
    }
  };

  const handleSave = useCallback(() => {
    if (data.onNodeUpdate) {
      data.onNodeUpdate(node.node_id, {
        title: formData.title,
        config: {
          ...node.config,
          condition_type: formData.condition_type,
          field_name: formData.field_name,
          operator: formData.operator,
          value: formData.value,
          conditions: formData.conditions
        }
      });
    }
    setIsEditing(false);
  }, [data, node, formData]);

  const handleAddCondition = useCallback(() => {
    if (newCondition.label.trim() && newCondition.value.trim()) {
      const updatedConditions = [...formData.conditions, { ...newCondition }];
      setFormData({ ...formData, conditions: updatedConditions });
      setNewCondition({ label: '', value: '' });
    }
  }, [newCondition, formData]);

  const handleRemoveCondition = useCallback((index: number) => {
    const updatedConditions = formData.conditions.filter((_, i) => i !== index);
    setFormData({ ...formData, conditions: updatedConditions });
  }, [formData]);
  
  return (
    <div 
      className={`
        px-4 py-3 rounded-lg border-2 min-w-[300px] max-w-[380px]
        ${selected 
          ? 'border-orange-500 shadow-lg shadow-orange-500/20' 
          : 'border-orange-400 shadow-md'
        }
        bg-gradient-to-r from-orange-50 to-orange-100
        hover:shadow-lg transition-all duration-200
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-orange-500 border-2 border-white"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-orange-600" />
          <div className="text-sm font-semibold text-orange-800">Condition</div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing && loadingGHLData && (
            <Loader2 className="w-3 h-3 text-orange-600 animate-spin" />
          )}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-1 hover:bg-orange-200 rounded transition-colors"
          >
            {isEditing ? (
              <Check className="w-4 h-4 text-orange-600" />
            ) : (
              <Edit2 className="w-4 h-4 text-orange-600" />
            )}
          </button>
        </div>
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
            placeholder="Condition title"
          />
        ) : (
          <div className={displayTextStyles.value}>
            {formData.title}
          </div>
        )}
      </div>
      
      {/* Condition Type */}
      <div className="mb-2">
        <label className={labelStyles}>Type:</label>
        {isEditing ? (
          <select
            value={formData.condition_type}
            onChange={(e) => setFormData({ ...formData, condition_type: e.target.value })}
            onBlur={handleSave}
            className={`${selectStyles.full} mt-1`}
          >
            <option value="field_equals">Field Equals</option>
            <option value="field_contains">Field Contains</option>
            <option value="field_greater">Field Greater Than</option>
            <option value="field_less">Field Less Than</option>
            <option value="has_tag">Has Tag</option>
            <option value="does_not_have_tag">Does Not Have Tag</option>
            <option value="custom_field_equals">Custom Field Equals</option>
            <option value="custom_field_contains">Custom Field Contains</option>
            <option value="custom_field_empty">Custom Field Empty</option>
            <option value="custom_field_not_empty">Custom Field Not Empty</option>
            <option value="custom">Custom Conditions</option>
          </select>
        ) : (
          <div className={`${displayTextStyles.value} mt-1`}>
            {formData.condition_type.replace(/_/g, ' ')}
          </div>
        )}
      </div>

      {/* Standard condition fields */}
      {formData.condition_type !== 'custom' && (
        <>
          <div className="mb-2">
            <label className={labelStyles}>
              {formData.condition_type.includes('tag') ? 'Tag:' : 
               formData.condition_type.includes('custom_field') ? 'Custom Field:' : 'Field:'}
            </label>
            {isEditing ? (
              <>
                {/* Tag selector for tag conditions */}
                {formData.condition_type.includes('tag') && (
                  <>
                    <input
                      type="text"
                      value={formData.field_name}
                      onChange={(e) => setFormData({ ...formData, field_name: e.target.value })}
                      onBlur={handleSave}
                      className={`${inputStyles.full} mt-1`}
                      placeholder="Tag name"
                      list={`tags-condition`}
                    />
                    <datalist id={`tags-condition`}>
                      {availableTags.map(tag => (
                        <option key={tag} value={tag} />
                      ))}
                    </datalist>
                  </>
                )}
                
                {/* Custom field selector */}
                {formData.condition_type.includes('custom_field') && (
                  <select
                    value={formData.field_name}
                    onChange={(e) => setFormData({ ...formData, field_name: e.target.value })}
                    onBlur={handleSave}
                    className={`${selectStyles.full} mt-1`}
                  >
                    <option value="">Select custom field...</option>
                    {customFields.map(field => (
                      <option key={field.id} value={field.fieldKey}>
                        {field.name} ({field.dataType})
                      </option>
                    ))}
                  </select>
                )}
                
                {/* Standard field input for other conditions */}
                {!formData.condition_type.includes('tag') && !formData.condition_type.includes('custom_field') && (
                  <input
                    type="text"
                    value={formData.field_name}
                    onChange={(e) => setFormData({ ...formData, field_name: e.target.value })}
                    onBlur={handleSave}
                    className={`${inputStyles.full} mt-1`}
                    placeholder="e.g., user_response, age, score"
                  />
                )}
              </>
            ) : (
              <div className={`${displayTextStyles.value} mt-1`}>
                {formData.field_name || <span className="text-gray-400 italic">Not set</span>}
              </div>
            )}
          </div>

          {/* Value field - not needed for tag conditions or empty/not empty checks */}
          {!formData.condition_type.includes('tag') && 
           !formData.condition_type.includes('empty') && (
            <div className="mb-2">
              <label className={labelStyles}>Value:</label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  onBlur={handleSave}
                  className={`${inputStyles.full} mt-1`}
                  placeholder="Expected value"
                />
              ) : (
                <div className={`${displayTextStyles.value} mt-1`}>
                  {formData.value || <span className="text-gray-400 italic">Not set</span>}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Custom conditions */}
      {formData.condition_type === 'custom' && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <label className={labelStyles}>Conditions:</label>
            {isEditing && (
              <button
                onClick={() => setNewCondition({ label: 'Option', value: '' })}
                className="p-1 bg-orange-200 hover:bg-orange-300 rounded transition-colors"
              >
                <Plus className="w-3 h-3 text-orange-700" />
              </button>
            )}
          </div>
          
          <div className="space-y-1">
            {formData.conditions.map((condition: any, index: number) => (
              <div key={index} className="relative group">
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`condition_${index}`}
                  style={{ top: '50%' }}
                  className="w-3 h-3 bg-orange-500 border-2 border-white"
                />
                
                <div className="flex items-center gap-1 pr-6">
                  <div className="flex-1 px-2 py-1 text-xs bg-orange-50 border border-orange-200 rounded">
                    {condition.label}: {condition.value}
                  </div>
                  {isEditing && (
                    <button
                      onClick={() => handleRemoveCondition(index)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            
            {isEditing && newCondition.label && (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newCondition.label}
                  onChange={(e) => setNewCondition({ ...newCondition, label: e.target.value })}
                  className={`w-1/3 ${inputStyles.full}`}
                  placeholder="Label"
                />
                <input
                  type="text"
                  value={newCondition.value}
                  onChange={(e) => setNewCondition({ ...newCondition, value: e.target.value })}
                  onBlur={() => newCondition.value.trim() && handleAddCondition()}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCondition()}
                  className={`flex-1 ${inputStyles.full}`}
                  placeholder="Value to check"
                  autoFocus
                />
                <button
                  onClick={handleAddCondition}
                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                >
                  <Check className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save button when editing */}
      {isEditing && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      )}

      {/* Handles for standard conditions */}
      {formData.condition_type !== 'custom' && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            className="w-3 h-3 bg-green-500 border-2 border-white"
            style={{ top: '30%', right: '-8px' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            className="w-3 h-3 bg-red-500 border-2 border-white"
            style={{ top: '70%', right: '-8px' }}
          />
        </>
      )}
      
      {/* Default handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="default"
        className="w-3 h-3 bg-gray-400 border-2 border-white"
        style={{ bottom: '10px', right: '-8px' }}
      />
    </div>
  );
}