import React, { useState, useCallback, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Calendar, Clock, Edit2, Check, Plus, X, Loader2 } from 'lucide-react';
import { inputStyles, textareaStyles, labelStyles, displayTextStyles, selectStyles } from './common-styles';

export default function AppointmentNode({ data, selected }: NodeProps) {
  const node = data.node;
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: node?.title || 'Book Appointment',
    calendar_id: node?.config?.calendar_id || node?.calendar_ids?.[0] || '', // Single calendar ID
    calendar_name: node?.config?.calendar_name || '', // Store calendar name for display
    reminder_message: node?.config?.reminder_message || '',
    booking_confirmation_message: node?.config?.booking_confirmation_message || 'Your appointment has been booked successfully!'
  });
  const [availableCalendars, setAvailableCalendars] = useState<Array<{
    id: string; 
    name: string; 
    description?: string;
    calendarType?: string;
  }>>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);

  // Load available calendars when editing starts
  useEffect(() => {
    if (isEditing && availableCalendars.length === 0) {
      loadAvailableCalendars();
    }
  }, [isEditing]);

  const loadAvailableCalendars = async () => {
    setLoadingCalendars(true);
    try {
      // Fetch calendars from the API endpoint
      const response = await fetch('/api/ghl/calendars');
      
      if (!response.ok) {
        throw new Error('Failed to fetch calendars');
      }
      
      const data = await response.json();
      
      // Check if there's an error message
      if (data.error) {
        console.log('Calendar fetch error:', data.error, data.details);
      }
      
      const calendars = data.calendars || [];
      console.log('Fetched calendars:', calendars);
      
      setAvailableCalendars(calendars);
      
      // Only update calendar name if we already have a calendar_id selected
      if (calendars.length > 0 && formData.calendar_id) {
        const selectedCalendar = calendars.find(c => c.id === formData.calendar_id);
        if (selectedCalendar) {
          setFormData(prev => ({
            ...prev,
            calendar_name: selectedCalendar.name
          }));
        }
      }
      // Don't auto-select the first calendar - let user choose
    } catch (error) {
      console.error('Failed to load calendars:', error);
      setAvailableCalendars([]);
    } finally {
      setLoadingCalendars(false);
    }
  };

  const handleSave = useCallback(() => {
    if (data.onNodeUpdate) {
      data.onNodeUpdate(node.node_id, {
        title: formData.title,
        config: {
          ...node.config,
          calendar_id: formData.calendar_id, // Store the selected calendar ID
          calendar_name: formData.calendar_name, // Store the calendar name for display
          reminder_message: formData.reminder_message,
          booking_confirmation_message: formData.booking_confirmation_message
        }
      });
    }
    setIsEditing(false);
  }, [data, node, formData]);

  // Reload calendars when node gets selected for editing
  useEffect(() => {
    if (isEditing && availableCalendars.length === 0) {
      loadAvailableCalendars();
    }
  }, [isEditing, availableCalendars.length]);
  
  return (
    <div 
      className={`
        px-4 py-3 rounded-lg border-2 min-w-[300px] max-w-[380px]
        ${selected 
          ? 'border-blue-500 shadow-lg shadow-blue-500/20' 
          : 'border-blue-400 shadow-md'
        }
        bg-gradient-to-r from-blue-50 to-blue-100
        hover:shadow-lg transition-all duration-200
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <div className="text-sm font-semibold text-blue-800">Book Appointment</div>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-1 hover:bg-blue-200 rounded transition-colors"
        >
          {isEditing ? (
            <Check className="w-4 h-4 text-blue-600" />
          ) : (
            <Edit2 className="w-4 h-4 text-blue-600" />
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
            placeholder="Appointment title"
          />
        ) : (
          <div className={displayTextStyles.value}>
            {formData.title}
          </div>
        )}
      </div>

      {/* Calendar Selection */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <label className={labelStyles}>Calendar:</label>
          {isEditing && loadingCalendars && (
            <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
          )}
        </div>
        
        {isEditing ? (
          <div>
            {loadingCalendars ? (
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading calendars...
              </div>
            ) : availableCalendars.length > 0 ? (
              <select
                value={formData.calendar_id || ''}
                onChange={(e) => {
                  const selectedCalendar = availableCalendars.find(c => c.id === e.target.value);
                  setFormData({ 
                    ...formData, 
                    calendar_id: e.target.value,
                    calendar_name: selectedCalendar?.name || ''
                  });
                }}
                onBlur={handleSave}
                className={`${selectStyles.full} mt-1`}
              >
                <option value="">Select a calendar...</option>
                {availableCalendars.map(calendar => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.name}
                    {calendar.calendarType ? ` (${calendar.calendarType})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-red-500 mt-1">
                No calendars found. Please ensure:
                <ul className="mt-1 ml-4 list-disc">
                  <li>GoHighLevel is connected</li>
                  <li>Your account has calendars configured</li>
                  <li>You have permission to access calendars</li>
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-1">
            {formData.calendar_name || formData.calendar_id ? (
              <div className="px-3 py-2 text-sm font-medium bg-white border border-gray-300 rounded-md text-gray-900">
                {formData.calendar_name || 'Calendar Selected'}
              </div>
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500 italic bg-gray-50 border border-gray-200 rounded-md">
                No calendar selected
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reminder Message */}
      {(isEditing || formData.reminder_message) && (
        <div className="mb-2">
          <label className={labelStyles}>Reminder Message:</label>
          {isEditing ? (
            <textarea
              value={formData.reminder_message}
              onChange={(e) => setFormData({ ...formData, reminder_message: e.target.value })}
              onBlur={handleSave}
              className={`${textareaStyles.full} mt-1`}
              rows={2}
              placeholder="Optional reminder message..."
            />
          ) : (
            <div className="text-xs text-gray-600 mt-1 italic">
              {formData.reminder_message}
            </div>
          )}
        </div>
      )}

      {/* Booking Confirmation Message */}
      <div className="mb-2">
        <label className={labelStyles}>Confirmation Message:</label>
        {isEditing ? (
          <textarea
            value={formData.booking_confirmation_message}
            onChange={(e) => setFormData({ ...formData, booking_confirmation_message: e.target.value })}
            onBlur={handleSave}
            className={`${textareaStyles.full} mt-1`}
            rows={2}
            placeholder="Message to send after booking..."
          />
        ) : (
          <div className={`text-xs text-gray-600 mt-1 ${formData.booking_confirmation_message ? '' : 'italic'}`}>
            {formData.booking_confirmation_message || 'Default confirmation message'}
          </div>
        )}
      </div>

      {/* Save button when editing */}
      {isEditing && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      )}

      {/* Success handle (top) - appointment booked */}
      <Handle
        type="source"
        position={Position.Top}
        id="booked"
        className="w-3 h-3 bg-green-500 border-2 border-white"
        style={{ top: -6, left: '50%', transform: 'translateX(-50%)' }}
      />

      {/* Standard handle (right) - continue flow */}
      <Handle
        type="source"
        position={Position.Right}
        id="standard"
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
    </div>
  );
}