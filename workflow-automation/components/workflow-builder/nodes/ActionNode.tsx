import React, { useState, useCallback, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Zap, Tag, Webhook, Mail, Edit2, Check, Plus, X, Send, Hash, UserPlus, FileText, Loader2 } from 'lucide-react';
import { inputStyles, labelStyles, displayTextStyles, selectStyles } from './common-styles';

const actionIcons: Record<string, any> = {
  add_tag: Tag,
  remove_tag: Tag,
  send_webhook: Webhook,
  send_email: Mail,
  send_sms: Send,
  update_custom_field: FileText,
  create_opportunity: UserPlus,
  custom: Zap,
  default: Zap
};

const actionTypes = [
  { value: 'add_tag', label: 'Add Tag', icon: Tag, placeholder: 'Tag name', hasGHLIntegration: true },
  { value: 'remove_tag', label: 'Remove Tag', icon: Tag, placeholder: 'Tag name', hasGHLIntegration: true },
  { value: 'send_sms', label: 'Send SMS', icon: Send, placeholder: 'Message content' },
  { value: 'send_email', label: 'Send Email', icon: Mail, placeholder: 'Email subject' },
  { value: 'update_custom_field', label: 'Update Custom Field', icon: FileText, placeholder: 'Field value', hasGHLIntegration: true },
  { value: 'create_opportunity', label: 'Create Opportunity', icon: UserPlus, placeholder: 'Opportunity name' },
  { value: 'send_webhook', label: 'Send Webhook', icon: Webhook, placeholder: 'Webhook URL' },
  { value: 'custom', label: 'Custom Action', icon: Zap, placeholder: 'Action value' }
];

export default function ActionNode({ data, selected }: NodeProps) {
  const node = data.node;
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: node?.title || 'Execute Action',
    actions: node?.actions || []
  });
  const [showActionPicker, setShowActionPicker] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<Array<{id: string; name: string; fieldKey: string; dataType: string}>>([]);
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
      const [tagsResponse, fieldsResponse] = await Promise.all([
        fetch('/api/ghl/tags'),
        fetch('/api/ghl/custom-fields')
      ]);
      
      if (tagsResponse.ok) {
        const tagsData = await tagsResponse.json();
        setAvailableTags(tagsData.tags || []);
      }
      
      if (fieldsResponse.ok) {
        const fieldsData = await fieldsResponse.json();
        setCustomFields(fieldsData.customFields || []);
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
        actions: formData.actions
      });
    }
    setIsEditing(false);
  }, [data, node, formData]);

  const handleAddAction = useCallback((type: string) => {
    const actionType = actionTypes.find(a => a.value === type);
    if (actionType) {
      const newAction: any = { type, value: '' };
      
      // Add default metadata for specific action types
      if (type === 'update_custom_field') {
        newAction.fieldId = '';
      } else if (type === 'create_opportunity') {
        newAction.pipelineId = '';
        newAction.stageId = '';
      } else if (type === 'send_email') {
        newAction.body = '';
      }
      
      setFormData({ ...formData, actions: [...formData.actions, newAction] });
      setShowActionPicker(false);
    }
  }, [formData]);

  const handleRemoveAction = useCallback((index: number) => {
    const updatedActions = formData.actions.filter((_, i) => i !== index);
    setFormData({ ...formData, actions: updatedActions });
  }, [formData]);

  const handleUpdateAction = useCallback((index: number, value: string) => {
    const updatedActions = [...formData.actions];
    updatedActions[index] = { ...updatedActions[index], value };
    setFormData({ ...formData, actions: updatedActions });
  }, [formData]);

  const primaryAction = formData.actions[0];
  const IconComponent = primaryAction ? (actionIcons[primaryAction.type] || Zap) : Zap;
  
  return (
    <div 
      className={`
        px-4 py-3 rounded-lg border-2 min-w-[300px] max-w-[380px]
        ${selected 
          ? 'border-amber-500 shadow-lg shadow-amber-500/20' 
          : 'border-amber-400 shadow-md'
        }
        bg-gradient-to-r from-amber-50 to-amber-100
        hover:shadow-lg transition-all duration-200
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-amber-500 border-2 border-white"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <IconComponent className="w-4 h-4 text-amber-600" />
          <div className="text-sm font-semibold text-amber-800">Action</div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing && loadingGHLData && (
            <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
          )}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-1 hover:bg-amber-200 rounded transition-colors"
          >
            {isEditing ? (
              <Check className="w-4 h-4 text-amber-600" />
            ) : (
              <Edit2 className="w-4 h-4 text-amber-600" />
            )}
          </button>
        </div>
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
            placeholder="Action title"
          />
        ) : (
          <div className={displayTextStyles.value}>
            {formData.title}
          </div>
        )}
      </div>
      
      {/* Actions List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelStyles}>Actions:</label>
          {isEditing && (
            <div className="relative">
              <button
                onClick={() => setShowActionPicker(!showActionPicker)}
                className="p-1.5 bg-amber-200 hover:bg-amber-300 rounded transition-colors"
              >
                <Plus className="w-3 h-3 text-amber-700" />
              </button>
              
              {/* Action Type Picker Dropdown */}
              {showActionPicker && (
                <div className="absolute right-0 top-8 z-10 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                  {actionTypes.map((actionType) => {
                    const Icon = actionType.icon;
                    return (
                      <button
                        key={actionType.value}
                        onClick={() => handleAddAction(actionType.value)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors"
                      >
                        <Icon className="w-4 h-4 text-gray-600" />
                        <span className="text-gray-900">{actionType.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          {formData.actions.map((action: any, index: number) => {
            const actionType = actionTypes.find(a => a.value === action.type);
            const Icon = actionType?.icon || Zap;
            
            return (
              <div key={index} className="group">
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-sm min-w-[120px]">
                        <Icon className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-amber-800 font-medium">{actionType?.label}</span>
                      </div>
                      
                      {/* Tag input with autocomplete */}
                      {(action.type === 'add_tag' || action.type === 'remove_tag') && (
                        <>
                          <input
                            type="text"
                            value={action.value}
                            onChange={(e) => handleUpdateAction(index, e.target.value)}
                            onBlur={handleSave}
                            className={`flex-1 ${inputStyles.full}`}
                            placeholder={actionType?.placeholder}
                            list={`tags-${index}`}
                          />
                          <datalist id={`tags-${index}`}>
                            {availableTags.map(tag => (
                              <option key={tag} value={tag} />
                            ))}
                          </datalist>
                        </>
                      )}
                      
                      {/* Custom field selector */}
                      {action.type === 'update_custom_field' && (
                        <select
                          value={action.fieldId || ''}
                          onChange={(e) => {
                            const updatedActions = [...formData.actions];
                            updatedActions[index] = { ...action, fieldId: e.target.value };
                            setFormData({ ...formData, actions: updatedActions });
                          }}
                          className={`flex-1 ${selectStyles.full}`}
                        >
                          <option value="">Select custom field...</option>
                          {customFields.map(field => (
                            <option key={field.id} value={field.id}>
                              {field.name} ({field.dataType})
                            </option>
                          ))}
                        </select>
                      )}
                      
                      {/* Standard input for other types */}
                      {action.type !== 'add_tag' && action.type !== 'remove_tag' && action.type !== 'update_custom_field' && (
                        <input
                          type="text"
                          value={action.value}
                          onChange={(e) => handleUpdateAction(index, e.target.value)}
                          onBlur={handleSave}
                          className={`flex-1 ${inputStyles.full}`}
                          placeholder={actionType?.placeholder}
                        />
                      )}
                      
                      <button
                        onClick={() => handleRemoveAction(index)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    {/* Additional fields */}
                    {action.type === 'update_custom_field' && action.fieldId && (
                      <input
                        type="text"
                        value={action.value}
                        onChange={(e) => handleUpdateAction(index, e.target.value)}
                        onBlur={handleSave}
                        className={`ml-[140px] ${inputStyles.full}`}
                        placeholder="Field value"
                      />
                    )}
                    
                    {action.type === 'send_email' && (
                      <textarea
                        value={action.body || ''}
                        onChange={(e) => {
                          const updatedActions = [...formData.actions];
                          updatedActions[index] = { ...action, body: e.target.value };
                          setFormData({ ...formData, actions: updatedActions });
                        }}
                        onBlur={handleSave}
                        className={`ml-[140px] ${inputStyles.full}`}
                        rows={2}
                        placeholder="Email body..."
                      />
                    )}
                    
                    {action.type === 'send_sms' && (
                      <div className="ml-[140px] text-xs text-gray-500">
                        SMS will be sent to the contact's phone number
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="w-1.5 h-1.5 bg-amber-400 rounded-full flex-shrink-0" />
                      <Icon className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    </div>
                    <div className="flex-1 text-sm">
                      <span className="font-medium text-gray-900">{actionType?.label}:</span>
                      <span className="text-gray-700 ml-1 break-all">
                        {action.type === 'update_custom_field' && action.fieldId ? (
                          <>
                            {customFields.find(f => f.id === action.fieldId)?.name || action.fieldId} = {action.value || <span className="text-gray-400 italic">Not set</span>}
                          </>
                        ) : action.type === 'send_email' ? (
                          <>
                            {action.value || <span className="text-gray-400 italic">No subject</span>}
                            {action.body && <div className="text-xs text-gray-500 mt-1">{action.body.substring(0, 50)}...</div>}
                          </>
                        ) : (
                          action.value || <span className="text-gray-400 italic">Not set</span>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {formData.actions.length === 0 && !isEditing && (
            <div className="text-sm text-gray-400 italic">No actions configured</div>
          )}
        </div>
      </div>

      {/* Save button when editing */}
      {isEditing && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-amber-500 border-2 border-white"
      />
    </div>
  );
}