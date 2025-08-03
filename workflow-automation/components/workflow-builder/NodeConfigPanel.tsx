import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { WorkflowNode, WorkflowAction, NodeType } from '@/types/bot-system';

interface NodeConfigPanelProps {
  node: WorkflowNode;
  onUpdate: (updates: Partial<WorkflowNode>) => void;
  onClose: () => void;
}

export default function NodeConfigPanel({ node, onUpdate, onClose }: NodeConfigPanelProps) {
  const [formData, setFormData] = useState({
    title: node.title || '',
    description: node.description || '',
    goal_description: node.goal_description || '',
    possible_outcomes: node.possible_outcomes || [],
    calendar_ids: node.calendar_ids || [],
    config: node.config || {},
    actions: node.actions || [],
  });

  const [newOutcome, setNewOutcome] = useState('');
  const [newCalendarId, setNewCalendarId] = useState('');
  const [newAction, setNewAction] = useState<Partial<WorkflowAction>>({
    type: 'add_tag',
    data: {},
  });

  // Update form when node changes
  useEffect(() => {
    setFormData({
      title: node.title || '',
      description: node.description || '',
      goal_description: node.goal_description || '',
      possible_outcomes: node.possible_outcomes || [],
      calendar_ids: node.calendar_ids || [],
      config: node.config || {},
      actions: node.actions || [],
    });
  }, [node]);

  const handleSave = () => {
    onUpdate(formData);
  };

  const addOutcome = () => {
    if (newOutcome.trim()) {
      setFormData({
        ...formData,
        possible_outcomes: [...formData.possible_outcomes, newOutcome.trim()],
      });
      setNewOutcome('');
    }
  };

  const removeOutcome = (index: number) => {
    setFormData({
      ...formData,
      possible_outcomes: formData.possible_outcomes.filter((_, i) => i !== index),
    });
  };

  const addCalendar = () => {
    if (newCalendarId.trim()) {
      setFormData({
        ...formData,
        calendar_ids: [...formData.calendar_ids, newCalendarId.trim()],
      });
      setNewCalendarId('');
    }
  };

  const removeCalendar = (index: number) => {
    setFormData({
      ...formData,
      calendar_ids: formData.calendar_ids.filter((_, i) => i !== index),
    });
  };

  const addAction = () => {
    if (newAction.type && newAction.data) {
      setFormData({
        ...formData,
        actions: [...formData.actions, newAction as WorkflowAction],
      });
      setNewAction({ type: 'add_tag', data: {} });
    }
  };

  const removeAction = (index: number) => {
    setFormData({
      ...formData,
      actions: formData.actions.filter((_, i) => i !== index),
    });
  };

  const updateConfig = (key: string, value: any) => {
    setFormData({
      ...formData,
      config: {
        ...formData.config,
        [key]: value,
      },
    });
  };

  return (
    <div className="w-96 bg-white border-l border-gray-200 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Configure Node</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="space-y-6">
        {/* Basic Info */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Node Title
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter node title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="Describe what this node does"
          />
        </div>

        {/* Node-specific configurations */}
        {node.node_type === 'milestone' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Goal Description
              </label>
              <textarea
                value={formData.goal_description}
                onChange={(e) => setFormData({ ...formData, goal_description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="What is the goal to achieve?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Possible Outcomes
              </label>
              <div className="space-y-2">
                {formData.possible_outcomes.map((outcome, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={outcome}
                      onChange={(e) => {
                        const updated = [...formData.possible_outcomes];
                        updated[index] = e.target.value;
                        setFormData({ ...formData, possible_outcomes: updated });
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <button
                      onClick={() => removeOutcome(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newOutcome}
                    onChange={(e) => setNewOutcome(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addOutcome()}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Add possible outcome"
                  />
                  <button
                    onClick={addOutcome}
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Success Threshold (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.config.success_threshold || 70}
                onChange={(e) => updateConfig('success_threshold', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </>
        )}

        {node.node_type === 'book_appointment' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Calendar IDs
              </label>
              <div className="space-y-2">
                {formData.calendar_ids.map((calendarId, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={calendarId}
                      onChange={(e) => {
                        const updated = [...formData.calendar_ids];
                        updated[index] = e.target.value;
                        setFormData({ ...formData, calendar_ids: updated });
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <button
                      onClick={() => removeCalendar(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCalendarId}
                    onChange={(e) => setNewCalendarId(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCalendar()}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Add calendar ID"
                  />
                  <button
                    onClick={addCalendar}
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Appointment Duration (minutes)
              </label>
              <input
                type="number"
                min="15"
                max="480"
                step="15"
                value={formData.config.duration_minutes || 30}
                onChange={(e) => updateConfig('duration_minutes', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </>
        )}

        {node.node_type === 'message' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message Content
            </label>
            <textarea
              value={formData.config.message || ''}
              onChange={(e) => updateConfig('message', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              placeholder="Enter the message to send"
            />
          </div>
        )}

        {node.node_type === 'condition' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Condition Type
            </label>
            <select
              value={formData.config.condition_type || 'keyword'}
              onChange={(e) => updateConfig('condition_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="keyword">Contains Keyword</option>
              <option value="sentiment">Sentiment Analysis</option>
              <option value="intent">Intent Matching</option>
              <option value="custom">Custom Logic</option>
            </select>
          </div>
        )}

        {node.node_type === 'end' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ending Message
            </label>
            <textarea
              value={formData.config.message || ''}
              onChange={(e) => updateConfig('message', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows={3}
              placeholder="Final message to the user"
            />
          </div>
        )}

        {/* Actions (for all node types except start/end) */}
        {!['start', 'end'].includes(node.node_type) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Actions
            </label>
            <div className="space-y-2">
              {formData.actions.map((action, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{action.type.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-gray-500">
                      {JSON.stringify(action.data)}
                    </div>
                  </div>
                  <button
                    onClick={() => removeAction(index)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              
              <div className="border-t pt-2">
                <select
                  value={newAction.type}
                  onChange={(e) => setNewAction({ ...newAction, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
                >
                  <option value="add_tag">Add Tag</option>
                  <option value="remove_tag">Remove Tag</option>
                  <option value="send_webhook">Send Webhook</option>
                  <option value="update_contact">Update Contact</option>
                </select>
                
                {newAction.type === 'add_tag' && (
                  <input
                    type="text"
                    placeholder="Tag name"
                    onChange={(e) => setNewAction({ ...newAction, data: { tag: e.target.value } })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
                  />
                )}
                
                {newAction.type === 'send_webhook' && (
                  <input
                    type="url"
                    placeholder="Webhook URL"
                    onChange={(e) => setNewAction({ ...newAction, data: { url: e.target.value } })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
                  />
                )}
                
                <button
                  onClick={addAction}
                  className="w-full px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Action
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}